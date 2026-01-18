// API route for updating individual order
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// PUT /api/orders/[id] - Update order status
export async function PUT(request, context) {
  try {
    console.log('=== Order Update Request ===')
    
    // In Next.js 15+, params is a Promise
    const params = await context.params
    const { id } = params
    
    console.log('Order ID:', id)
    
    const { requireAuth: requireAuthHelper, getUserBySupabaseAuthId } = await import('@/lib/auth')
    
    let session
    try {
      session = await requireAuthHelper(request)
    } catch (authError) {
      console.error('Authentication failed:', authError.message)
      return NextResponse.json({ error: 'Unauthorized - Please log in' }, { status: 401 })
    }
    
    const user = await getUserBySupabaseAuthId(session.user.id)
    
    console.log('User:', user?.id, user?.user_type)
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    const body = await request.json()
    const { status } = body
    
    console.log('Requested status:', status)

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'dispatched', 'delivered', 'cancelled']
    if (!status || !validStatuses.includes(status)) {
      console.error('Invalid status:', status)
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Fetch order to check ownership
    console.log('Fetching order...')
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('Fetch error:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 404 })
    }
    
    if (!order) {
      console.error('Order not found')
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    
    console.log('Order found - seller_id:', order.seller_id)

    // Check permissions: Seller can update orders they own, Admin can update any
    if (user.user_type === 'Seller' && order.seller_id !== user.id) {
      console.error('Permission denied - seller_id mismatch')
      return NextResponse.json({ error: 'Forbidden - You can only update your own orders' }, { status: 403 })
    }

    if (user.user_type === 'Buyer') {
      console.error('Permission denied - buyers cannot update')
      return NextResponse.json({ error: 'Forbidden - Buyers cannot update order status' }, { status: 403 })
    }

    // Update order status
    console.log('Updating order status...')
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select(`
        *,
        order_items (
          id,
          quantity,
          price,
          gift_packaging,
          customizations,
          product_id,
          products (
            id,
            name,
            description,
            price,
            images,
            category,
            weight
          )
        ),
        sellers!seller_id (
          id,
          business_name,
          full_name,
          primary_mobile,
          business_address,
          city,
          state,
          pincode
        ),
        buyers!buyer_id (
          id,
          city,
          address,
          state,
          pincode,
          phone
        )
      `)
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Create Shiprocket shipment when order is confirmed
    if (status === 'confirmed' && !order.shipment_id) {
      console.log('Creating Shiprocket shipment...')
      try {
        const { createShipment } = await import('@/lib/shiprocket')
        
        // Parse delivery address from order.address string
        const addressParts = order.address.split(',').map(s => s.trim())
        const phoneMatch = order.address.match(/Phone:\s*(\d+)/)
        
        const deliveryAddress = {
          name: addressParts[0] || 'Customer',
          address: addressParts.slice(1, -3).join(', ') || order.address,
          city: updatedOrder.buyers?.city || 'Mumbai',
          state: updatedOrder.buyers?.state || 'Maharashtra',
          pincode: updatedOrder.buyers?.pincode || '400001',
          phone: phoneMatch ? phoneMatch[1] : updatedOrder.buyers?.phone || '9999999999',
          email: 'customer@zaryah.com'
        }

        const pickupLocation = {
          name: 'Primary',
          address: updatedOrder.sellers?.business_address || 'Pickup Address',
          city: updatedOrder.sellers?.city || 'Mumbai',
          state: updatedOrder.sellers?.state || 'Maharashtra',
          pincode: updatedOrder.sellers?.pincode || '400001'
        }

        const items = (updatedOrder.order_items || []).map(item => ({
          id: item.product_id,
          name: item.products?.name || 'Product',
          quantity: item.quantity,
          price: item.price,
          weight: item.products?.weight || 0.5
        }))

        const shipment = await createShipment({
          orderId: id,
          orderDate: new Date(order.created_at).toISOString().split('T')[0],
          pickupLocation,
          deliveryAddress,
          items,
          totalAmount: order.total_amount,
          paymentMethod: order.payment_method
        })

        console.log('Shipment created:', shipment)

        // Update order with shipment details
        await supabase
          .from('orders')
          .update({
            shipment_id: shipment.shipment_id,
            awb_code: shipment.awb_code,
            courier_name: shipment.courier_name,
            tracking_url: shipment.tracking_url,
            shipment_status: shipment.status,
            shipment_created_at: new Date().toISOString()
          })
          .eq('id', id)

        // Add shipment info to response
        updatedOrder.shipment_id = shipment.shipment_id
        updatedOrder.awb_code = shipment.awb_code
        updatedOrder.courier_name = shipment.courier_name
        updatedOrder.tracking_url = shipment.tracking_url
        updatedOrder.shipment_status = shipment.status

        console.log('Shipment details saved to order')
      } catch (shipmentError) {
        console.error('Shipment creation error:', shipmentError)
        // Don't fail the order update if shipment creation fails
        // Shipment can be created manually later
      }
    }

    console.log('Order updated successfully')
    return NextResponse.json(updatedOrder)
  } catch (error) {
    console.error('=== Error updating order ===')
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
