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
    const { orderId } = body

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
      .select('id, seller_id, shipment_id, awb_code, courier_name, tracking_url, status')
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
    const isAdmin = user.user_type === 'Admin'

    if (!isSeller && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Only seller or admin can generate labels' },
        { status: 403 }
      )
    }

    // Check if order has shipment_id
    if (!order.shipment_id) {
      return NextResponse.json(
        { 
          error: 'No shipment found for this order. Please confirm the order first to create a shipment.',
          courierAssigned: false
        },
        { status: 400 }
      )
    }

    console.log('Shipment ID:', order.shipment_id)

    // Fetch shipment details from Shiprocket to get courier info and label URL
    let shipmentDetails
    try {
      shipmentDetails = await getShipmentDetails(order.shipment_id)
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
      
      // Try to fetch label anyway as a fallback - maybe it exists even if AWB isn't showing
      console.log('🔄 Attempting to fetch label as fallback...')
      try {
        const labelData = await fetchShippingLabel(order.shipment_id)
        console.log('✅ Label found via fallback!', labelData.labelUrl)
        
        // Update order with any info we got
        if (labelData.awbCode || labelData.courierName) {
          console.log('📝 Updating order (fallback) with courier info:', {
            orderId,
            awb_code: labelData.awbCode || shipmentDetails.awbCode,
            courier_name: labelData.courierName || shipmentDetails.courierName
          })
          
          const { data: updateData, error: updateError } = await supabase
            .from('orders')
            .update({
              awb_code: labelData.awbCode || shipmentDetails.awbCode,
              courier_name: labelData.courierName || shipmentDetails.courierName,
              updated_at: new Date().toISOString()
            })
            .eq('id', orderId)
            .select()
          
          if (updateError) {
            console.error('❌ Failed to update order (fallback):', updateError)
          } else {
            console.log('✅ Order updated (fallback) successfully:', updateData)
          }
        }
        
        return NextResponse.json({
          success: true,
          labelUrl: labelData.labelUrl,
          awbCode: labelData.awbCode || shipmentDetails.awbCode,
          courierName: labelData.courierName || shipmentDetails.courierName,
          courierAssigned: true,
          shipmentId: order.shipment_id,
          note: 'Label retrieved via fallback method'
        })
      } catch (fallbackError) {
        console.error('❌ Fallback label fetch also failed:', fallbackError)
        return NextResponse.json(
          { 
            error: 'Courier not assigned yet. Please go to Shiprocket dashboard and assign a courier service first.',
            courierAssigned: false,
            shiprocketDashboardUrl: 'https://app.shiprocket.in/seller',
            shipmentId: order.shipment_id,
            debugInfo: {
              courierName: shipmentDetails.courierName,
              awbCode: shipmentDetails.awbCode,
              status: shipmentDetails.status
            }
          },
          { status: 400 }
        )
      }
    }

    console.log('✅ Courier assigned:', shipmentDetails.courierName)

    // Update order with courier info if not already in DB
    if (shipmentDetails.awbCode && shipmentDetails.courierName) {
      console.log('📝 Updating order in database with courier info:', {
        orderId,
        awb_code: shipmentDetails.awbCode,
        courier_name: shipmentDetails.courierName
      })
      
      const { data: updateData, error: updateError } = await supabase
        .from('orders')
        .update({
          awb_code: shipmentDetails.awbCode,
          courier_name: shipmentDetails.courierName,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select()
      
      if (updateError) {
        console.error('❌ Failed to update order with courier info:', updateError)
      } else {
        console.log('✅ Order updated successfully:', updateData)
        
        // Verify the update by fetching the order again
        const { data: verifyOrder } = await supabase
          .from('orders')
          .select('courier_name, awb_code')
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
        const labelData = await fetchShippingLabel(order.shipment_id)
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
            shipmentId: order.shipment_id
          },
          { status: 400 }
        )
      }
    } else {
      console.log('✅ Label URL found in shipment details:', labelUrl)
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
