// API route for generating shipping labels
import { NextResponse } from 'next/server'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { generateShippingLabel, getShipmentDetails } from '@/lib/shiprocket'

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

    // Fetch order from database
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, seller_id, shipment_id, awb_code, courier_name, status')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      console.error('Order fetch error:', orderError)
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

    // Check if courier is assigned (by fetching latest shipment details)
    let shipmentDetails
    try {
      shipmentDetails = await getShipmentDetails(order.shipment_id)
      console.log('Shipment details:', shipmentDetails)
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

    if (!shipmentDetails.courierAssigned) {
      return NextResponse.json(
        { 
          error: 'Courier not assigned yet. Please go to Shiprocket dashboard and assign a courier service first.',
          courierAssigned: false,
          shiprocketDashboardUrl: 'https://app.shiprocket.in/seller'
        },
        { status: 400 }
      )
    }

    console.log('Courier assigned:', shipmentDetails.courierName)

    // Generate the shipping label
    let labelData
    try {
      labelData = await generateShippingLabel(order.shipment_id)
      console.log('Label generated:', labelData.labelUrl)
    } catch (error) {
      console.error('Label generation error:', error)
      return NextResponse.json(
        { 
          error: error.message || 'Failed to generate shipping label',
          courierAssigned: shipmentDetails.courierAssigned
        },
        { status: 500 }
      )
    }

    // Update order with latest shipment info
    await supabase
      .from('orders')
      .update({
        awb_code: labelData.awbCode,
        courier_name: labelData.courierName,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)

    console.log('=== Label Generated Successfully ===')

    return NextResponse.json({
      success: true,
      labelUrl: labelData.labelUrl,
      awbCode: labelData.awbCode,
      courierName: labelData.courierName,
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
