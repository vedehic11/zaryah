// API route for generating shipping labels
import { NextResponse } from 'next/server'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { fetchShippingLabel, getShipmentDetails } from '@/lib/shiprocket'

/**
 * POST /api/orders/shipping-label
 * Generate shipping label for an order
 * Requires: orderId in request body
 * Returns: labelUrl (PDF with QR code), awbCode, courierName
 */
export async function POST(request) {
  try {
    console.log('=== Shipping Label Request ===')
    
    // Authenticate user
    let session
    try {
      session = await requireAuth(request)
    } catch (authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserBySupabaseAuthId(session.user.id)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    const body = await request.json()
    const { orderId, direction } = body
    const normalizedDirection = direction === 'inbound' ? 'inbound' : 'outbound'

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      )
    }

    console.log('Fetching order:', orderId)

    // Fetch order from database (with all courier/shipment fields)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, buyer_id, seller_id, shipment_id, awb_code, courier_name, tracking_url, inbound_shipment_id, inbound_awb_code, inbound_courier_name, inbound_tracking_url, status')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      console.error('Order fetch error:', orderError)
      // Log specific error details
      if (orderError) {
        console.error('Error details:', {
          message: orderError.message,
          details: orderError.details,
          hint: orderError.hint,
          code: orderError.code
        })
      }
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Verify user is the seller or admin
    const isSeller = order.seller_id === user.id
    const isBuyer = order.buyer_id === user.id
    const isAdmin = user.user_type === 'Admin'

    if (!isSeller && !isBuyer && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - You do not have access to this label' },
        { status: 403 }
      )
    }

    // Check if order has shipment_id
    const shipmentId = normalizedDirection === 'inbound' ? order.inbound_shipment_id : order.shipment_id

    if (!shipmentId) {
      return NextResponse.json(
        { 
          error: normalizedDirection === 'inbound'
            ? 'Pickup is yet to be created.'
            : 'Shipment is yet to be created.',
          courierAssigned: false
        },
        { status: 400 }
      )
    }

    console.log('Shipment ID:', shipmentId)

    // Fetch shipment details from Shiprocket to get courier info and label URL
    let shipmentDetails
    try {
      shipmentDetails = await getShipmentDetails(shipmentId)
      console.log('📋 Shipment details response:', {
        shipmentId: shipmentDetails.shipmentId,
        awbCode: shipmentDetails.awbCode,
        courierName: shipmentDetails.courierName,
        courierAssigned: shipmentDetails.courierAssigned,
        labelUrl: shipmentDetails.labelUrl,
        status: shipmentDetails.status
      })
    } catch (error) {
      console.error('Error fetching shipment details:', error)
      return NextResponse.json(
        { 
          error: 'Failed to fetch shipment details from Shiprocket. Please try again.',
          courierAssigned: false
        },
        { status: 500 }
      )
    }

    // Check if courier is assigned
    if (!shipmentDetails.courierAssigned) {
      console.log('❌ Courier not assigned according to check')
      console.log('🔍 Debug info:', {
        hasCourierName: !!shipmentDetails.courierName,
        courierName: shipmentDetails.courierName,
        hasAwbCode: !!shipmentDetails.awbCode,
        awbCode: shipmentDetails.awbCode
      })
      return NextResponse.json(
        {
          error: 'Shipment is yet to be created.',
          courierAssigned: false,
          shiprocketDashboardUrl: 'https://app.shiprocket.in/seller',
          shipmentId: shipmentId,
          debugInfo: {
            courierName: shipmentDetails.courierName,
            awbCode: shipmentDetails.awbCode,
            status: shipmentDetails.status
          }
        },
        { status: 400 }
      )
    }

    console.log('✅ Courier assigned:', shipmentDetails.courierName)

    // Update order with courier info if not already in DB
    if (shipmentDetails.awbCode && shipmentDetails.courierName) {
      console.log('📝 Updating order in database with courier info:', {
        orderId,
        awb_code: shipmentDetails.awbCode,
        courier_name: shipmentDetails.courierName
      })
      
      const trackingUrl = shipmentDetails.awbCode
        ? `https://shiprocket.co/tracking/${shipmentDetails.awbCode}`
        : null

      const updatePayload = normalizedDirection === 'inbound'
        ? {
            inbound_awb_code: shipmentDetails.awbCode,
            inbound_courier_name: shipmentDetails.courierName,
            inbound_tracking_url: trackingUrl,
            updated_at: new Date().toISOString()
          }
        : {
            awb_code: shipmentDetails.awbCode,
            courier_name: shipmentDetails.courierName,
            tracking_url: trackingUrl,
            updated_at: new Date().toISOString()
          }

      const { data: updateData, error: updateError } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId)
        .select()
      
      if (updateError) {
        console.error('❌ Failed to update order with courier info:', updateError)
      } else {
        console.log('✅ Order updated successfully:', updateData)
        
        // Verify the update by fetching the order again
        const { data: verifyOrder } = await supabase
          .from('orders')
          .select('courier_name, awb_code, inbound_courier_name, inbound_awb_code')
          .eq('id', orderId)
          .single()
        
        console.log('🔍 Verification - Order data after update:', verifyOrder)
      }
    } else {
      console.warn('⚠️ Cannot update order - missing courier info:', {
        hasAwbCode: !!shipmentDetails.awbCode,
        awbCode: shipmentDetails.awbCode,
        hasCourierName: !!shipmentDetails.courierName,
        courierName: shipmentDetails.courierName
      })
    }

    // Try to get label URL
    let labelUrl = shipmentDetails.labelUrl
    
    // If label URL not in shipment details, try fetching it from Shiprocket
    if (!labelUrl) {
      console.log('⚠️ Label URL not in shipment details, trying to fetch from Shiprocket...')
      try {
        const labelData = await fetchShippingLabel(shipmentId)
        labelUrl = labelData.labelUrl
        console.log('✅ Label fetched successfully:', labelUrl)
      } catch (error) {
        console.error('❌ Failed to fetch label:', error)
        return NextResponse.json(
          { 
            error: error.message || 'Shipping label not available yet. Please wait a few moments and try again, or download it from Shiprocket dashboard.',
            courierAssigned: true,
            awbCode: shipmentDetails.awbCode,
            courierName: shipmentDetails.courierName,
            shiprocketDashboardUrl: 'https://app.shiprocket.in/seller',
            shipmentId: shipmentId
          },
          { status: 400 }
        )
      }
    } else {
      console.log('✅ Label URL found in shipment details:', labelUrl)
    }

    if (!labelUrl) {
      return NextResponse.json(
        {
          error: 'Shipment is yet to be created.',
          courierAssigned: false,
          shipmentId: shipmentId
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      labelUrl: labelUrl,
      awbCode: shipmentDetails.awbCode,
      courierName: shipmentDetails.courierName,
      courierAssigned: true,
      shipmentId: order.shipment_id
    })

  } catch (error) {
    console.error('Shipping label API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
