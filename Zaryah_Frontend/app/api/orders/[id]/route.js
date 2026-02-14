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
    
    console.log('Order found - current status:', order.status, '- requested:', status)

    // VALIDATION: Check if status transition is allowed
    const validTransitions = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['dispatched', 'cancelled'],
      'dispatched': ['delivered', 'cancelled'],
      'delivered': [], // No transitions allowed from delivered
      'cancelled': [] // No transitions allowed from cancelled
    }

    const allowedNextStatuses = validTransitions[order.status] || []
    if (!allowedNextStatuses.includes(status)) {
      console.error(`Invalid status transition: ${order.status} -> ${status}`)
      return NextResponse.json({ 
        error: 'Invalid status transition',
        message: `Cannot change status from "${order.status}" to "${status}". Allowed: ${allowedNextStatuses.join(', ') || 'none'}`
      }, { status: 400 })
    }

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
        // Format: "Name, address lines, City, State - Pincode. Phone: 1234567890"
        const addressParts = order.address.split(',').map(s => s.trim())
        const phoneMatch = order.address.match(/Phone:\s*(\d+)/)
        const phone = phoneMatch ? phoneMatch[1] : updatedOrder.buyers?.phone
        
        // Extract state and pincode from "State - Pincode" format (last part before phone)
        const stateAndPincodeMatch = order.address.match(/([A-Za-z\s]+)\s*-\s*(\d{6})/)
        const state = stateAndPincodeMatch ? stateAndPincodeMatch[1].trim() : null
        const pincode = stateAndPincodeMatch ? stateAndPincodeMatch[2] : null
        
        // City is typically the second-to-last part (before state)
        const city = addressParts[addressParts.length - 3]?.replace(/\s*-.*$/, '').trim() || 
                     addressParts[addressParts.length - 2]?.replace(/\s*-.*$/, '').trim()
        
        // Get name from first part
        const name = addressParts[0] || 'Customer'
        
        // Get street address (everything between name and city)
        const addressIndex = order.address.indexOf(',')
        const cityIndex = order.address.lastIndexOf(city)
        const streetAddress = addressIndex >= 0 && cityIndex > addressIndex 
          ? order.address.substring(addressIndex + 1, cityIndex).trim().replace(/,$/, '')
          : addressParts.slice(1, -2).join(', ')
        
        if (!city || !state || !pincode || !phone) {
          throw new Error(`Incomplete delivery address. Missing: ${[
            !city && 'city',
            !state && 'state',
            !pincode && 'pincode',
            !phone && 'phone'
          ].filter(Boolean).join(', ')}. Address: ${order.address}`)
        }
        
        // Validate phone number format (10 digits)
        if (!/^\d{10}$/.test(phone)) {
          throw new Error('Invalid phone number. Must be 10 digits.')
        }
        
        // Validate pincode format (6 digits)
        if (!/^\d{6}$/.test(pincode)) {
          throw new Error('Invalid pincode. Must be 6 digits.')
        }
        
        const deliveryAddress = {
          name: name,
          address: streetAddress,
          city: city,
          state: state,
          pincode: pincode,
          phone: phone,
          email: updatedOrder.buyers?.email || 'customer@zaryah.com'
        }

        console.log('Parsed delivery address:', deliveryAddress)

        // Get seller's address from sellers table (already has address columns from migration)
        const sellerCity = updatedOrder.sellers?.city
        const sellerState = updatedOrder.sellers?.state
        const sellerPincode = updatedOrder.sellers?.pincode
        const sellerAddress = updatedOrder.sellers?.business_address
        const sellerPhone = updatedOrder.sellers?.primary_mobile
        const sellerName = updatedOrder.sellers?.full_name || updatedOrder.sellers?.business_name
        
        if (!sellerCity || !sellerState || !sellerPincode || !sellerAddress || !sellerPhone) {
          throw new Error(`Incomplete seller pickup address. Missing: ${[
            !sellerCity && 'city',
            !sellerState && 'state',
            !sellerPincode && 'pincode',
            !sellerAddress && 'business_address',
            !sellerPhone && 'phone'
          ].filter(Boolean).join(', ')}. Please ensure seller has completed their profile with complete address details.`)
        }
        
        const pickupLocation = {
          name: 'Primary',
          contactName: sellerName,
          phone: sellerPhone,
          address: sellerAddress,
          city: sellerCity,
          state: sellerState,
          pincode: sellerPincode
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

        // Prepare update data
        const shipmentUpdate = {
          shipment_id: shipment.shipment_id,
          awb_code: shipment.awb_code,
          courier_name: shipment.courier_name,
          tracking_url: shipment.tracking_url,
          shipment_status: shipment.status,
          shipment_created_at: new Date().toISOString()
        }

        // If AWB code is assigned, update status to dispatched
        if (shipment.awb_code) {
          shipmentUpdate.status = 'dispatched'
          console.log('✅ AWB assigned, updating status to dispatched')
        }

        // Update order with shipment details
        await supabase
          .from('orders')
          .update(shipmentUpdate)
          .eq('id', id)

        // Add shipment info to response
        updatedOrder.shipment_id = shipment.shipment_id
        updatedOrder.awb_code = shipment.awb_code
        updatedOrder.courier_name = shipment.courier_name
        updatedOrder.tracking_url = shipment.tracking_url
        updatedOrder.shipment_status = shipment.status
        
        // Update status in response if dispatched
        if (shipment.awb_code) {
          updatedOrder.status = 'dispatched'
        }

        console.log('Shipment details saved to order')
      } catch (shipmentError) {
        console.error('❌ Shipment creation failed:', shipmentError.message)
        
        // Set order to special status indicating shipment needs manual creation
        await supabase
          .from('orders')
          .update({ 
            status: 'confirmed',
            // Store error message for seller to see
            notes: `Shipment creation failed: ${shipmentError.message}. Please create shipment manually in Shiprocket dashboard.`
          })
          .eq('id', id)
        
        // Update response to reflect shipment failure
        updatedOrder.status = 'confirmed'
        updatedOrder.shipment_error = shipmentError.message
        
        console.warn('⚠️  Order confirmed but shipment creation failed. Manual intervention required.')
      }
    }

    // Handle order delivery - release seller funds and update payment status
    if (status === 'delivered') {
      console.log('Processing order delivery...')
      
      try {
        // Release seller wallet funds from pending to available
        if (order.seller_id) {
          console.log(`Releasing pending funds for seller ${order.seller_id}...`)
          
          // Calculate seller earnings (95% of order total)
          const sellerEarnings = parseFloat(order.total_amount) * 0.95
          
          // Get current wallet
          const { data: wallet } = await supabase
            .from('wallets')
            .select('*')
            .eq('seller_id', order.seller_id)
            .single()
          
          if (wallet) {
            // Move funds from pending to available
            await supabase
              .from('wallets')
              .update({
                pending_balance: (parseFloat(wallet.pending_balance) || 0) - sellerEarnings,
                available_balance: (parseFloat(wallet.available_balance) || 0) + sellerEarnings,
                total_earned: (parseFloat(wallet.total_earned) || 0) + sellerEarnings
              })
              .eq('seller_id', order.seller_id)
            
            // Update transaction status
            await supabase
              .from('transactions')
              .update({
                status: 'completed',
                description: `Order #${id} - Delivered`
              })
              .eq('order_id', id)
              .eq('seller_id', order.seller_id)
            
            console.log('✅ Seller funds released to available balance')
          }
        }
        
        // Update COD payment status to paid on delivery
        if (order.payment_method === 'cod' && order.payment_status !== 'paid') {
          console.log('Updating COD order payment status to paid...')
          
          await supabase
            .from('orders')
            .update({ payment_status: 'paid' })
            .eq('id', id)
          
          updatedOrder.payment_status = 'paid'
          console.log('✅ COD payment marked as paid')
        }
      } catch (deliveryError) {
        console.error('Error processing delivery:', deliveryError)
        // Don't fail the status update, just log the error
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
