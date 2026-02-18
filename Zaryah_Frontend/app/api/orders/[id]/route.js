// API route for updating individual order
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'

// PATCH /api/orders/[id] - Update order fields (like payment_id)
export async function PATCH(request, context) {
  try {
    const params = await context.params
    const { id } = params
    
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
    
    // Fetch order to check ownership
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('buyer_id, seller_id')
      .eq('id', id)
      .single()

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    
    // Check permissions: Owner or admin can update
    const isOwner = order.buyer_id === user.id || order.seller_id === user.id
    const isAdmin = user.user_type === 'Admin'
    
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Update allowed fields
    const allowedFields = ['payment_id', 'razorpay_order_id', 'razorpay_payment_id', 'notes']
    const updateData = {}
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // Update order
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json(updatedOrder)
  } catch (error) {
    console.error('Error in PATCH /api/orders/[id]:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/orders/[id] - Update order status
export async function PUT(request, context) {
  try {
    console.log('=== Order Update Request ===')
    
    // In Next.js 15+, params is a Promise
    const params = await context.params
    const { id } = params
    
    console.log('Order ID:', id)
    
    let session
    try {
      session = await requireAuth(request)
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
        
        // Parse delivery address - can be JSON object or string
        let deliveryAddress
        
        if (typeof order.address === 'string') {
          // Legacy: Parse from string format: "Name, address lines, City, State - Pincode. Phone: 1234567890"
          console.log('Parsing address from string:', order.address)
          const addressParts = order.address.split(',').map(s => s.trim())
          const phoneMatch = order.address.match(/Phone:\s*(\d+)/)
          const phone = phoneMatch ? phoneMatch[1] : updatedOrder.buyers?.phone
          
          const stateAndPincodeMatch = order.address.match(/([A-Za-z\s]+)\s*-\s*(\d{6})/)
          const state = stateAndPincodeMatch ? stateAndPincodeMatch[1].trim() : null
          const pincode = stateAndPincodeMatch ? stateAndPincodeMatch[2] : null
          
          const city = addressParts[addressParts.length - 3]?.replace(/\s*-.*$/, '').trim() || 
                       addressParts[addressParts.length - 2]?.replace(/\s*-.*$/, '').trim()
          
          const name = addressParts[0] || 'Customer'
          
          const addressIndex = order.address.indexOf(',')
          const cityIndex = order.address.lastIndexOf(city)
          const streetAddress = addressIndex >= 0 && cityIndex > addressIndex 
            ? order.address.substring(addressIndex + 1, cityIndex).trim().replace(/,$/, '')
            : addressParts.slice(1, -2).join(', ')
          
          deliveryAddress = {
            name: name,
            address: streetAddress,
            city: city,
            state: state,
            pincode: pincode,
            phone: phone,
            email: updatedOrder.buyers?.email || 'customer@zaryah.com'
          }
        } else if (typeof order.address === 'object' && order.address !== null) {
          // New format: Address stored as JSON object
          console.log('Using address object:', order.address)
          deliveryAddress = {
            name: order.address.name || order.address.fullName || 'Customer',
            address: order.address.address || order.address.streetAddress || '',
            city: order.address.city || '',
            state: order.address.state || '',
            pincode: order.address.pincode || order.address.zipCode || '',
            phone: order.address.phone || order.address.mobile || updatedOrder.buyers?.phone || '',
            email: order.address.email || updatedOrder.buyers?.email || 'customer@zaryah.com'
          }
        } else {
          throw new Error('Invalid address format in order')
        }
        
        console.log('Parsed delivery address:', deliveryAddress)
        
        // Validate required fields
        if (!deliveryAddress.city || !deliveryAddress.state || !deliveryAddress.pincode || !deliveryAddress.phone) {
          throw new Error(`Incomplete delivery address. Missing: ${[
            !deliveryAddress.city && 'city',
            !deliveryAddress.state && 'state',
            !deliveryAddress.pincode && 'pincode',
            !deliveryAddress.phone && 'phone'
          ].filter(Boolean).join(', ')}`)
        }
        
        // Validate phone number format (10 digits)
        if (!/^\d{10}$/.test(deliveryAddress.phone)) {
          throw new Error('Invalid phone number. Must be 10 digits.')
        }
        
        // Validate pincode format (6 digits)
        if (!/^\d{6}$/.test(deliveryAddress.pincode)) {
          throw new Error('Invalid pincode. Must be 6 digits.')
        }

        // Get seller's address from sellers table (already has address columns from migration)
        console.log('Seller data from order:', updatedOrder.sellers)
        const sellerCity = updatedOrder.sellers?.city
        const sellerState = updatedOrder.sellers?.state
        const sellerPincode = updatedOrder.sellers?.pincode
        let sellerAddress = updatedOrder.sellers?.business_address
        const sellerPhone = updatedOrder.sellers?.primary_mobile
        const sellerName = updatedOrder.sellers?.full_name || updatedOrder.sellers?.business_name
        
        // FALLBACK: If business_address is empty, construct from city/state/pincode
        if (!sellerAddress || sellerAddress.trim() === '') {
          if (sellerCity && sellerState && sellerPincode) {
            sellerAddress = `${sellerCity}, ${sellerState} - ${sellerPincode}`
            console.log('⚠️ No business_address found, using constructed address:', sellerAddress)
          }
        }
        
        console.log('Extracted seller address fields:', {
          city: sellerCity,
          state: sellerState,
          pincode: sellerPincode,
          address: sellerAddress,
          phone: sellerPhone,
          name: sellerName
        })
        
        // Validate required fields (city/state/pincode are mandatory for pickup)
        if (!sellerCity || !sellerState || !sellerPincode || !sellerPhone) {
          throw new Error(`Incomplete seller pickup address. Missing: ${[
            !sellerCity && 'city',
            !sellerState && 'state',
            !sellerPincode && 'pincode',
            !sellerPhone && 'phone'
          ].filter(Boolean).join(', ')}. Please ensure seller has completed their profile with complete address details.`)
        }
        
        // Final address check (either business_address or constructed address must exist)
        if (!sellerAddress) {
          throw new Error('Seller must have either business_address or city+state+pincode filled in their profile.')
        }
        
        // Use unique pickup location name per seller to avoid conflict with account's primary address
        const pickupLocationName = updatedOrder.sellers?.business_name 
          ? `${updatedOrder.sellers.business_name.substring(0, 20)}_${order.seller_id.substring(0, 8)}`
          : `Seller_${order.seller_id.substring(0, 8)}`
        
        const pickupLocation = {
          name: pickupLocationName,
          contactName: sellerName,
          phone: sellerPhone,
          address: sellerAddress,
          city: sellerCity,
          state: sellerState,
          pincode: sellerPincode,
          email: updatedOrder.sellers?.email || 'seller@zaryah.com'
        }
        
        console.log('Final pickup location for Shiprocket:', pickupLocation)

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
        // When order is delivered, wallet balances update automatically
        // because they're calculated from order status
        if (order.seller_id) {
          console.log(`Order delivered for seller ${order.seller_id}`)
          
          // Calculate seller earnings from product subtotal only
          const { data: orderItems } = await supabase
            .from('order_items')
            .select('quantity, price')
            .eq('order_id', id)
          
          const productSubtotal = (orderItems || []).reduce((sum, item) => 
            sum + (parseFloat(item.price) * item.quantity), 0
          )
          
          const sellerEarnings = parseFloat((productSubtotal * 0.975).toFixed(2))
          const platformCommission = parseFloat((productSubtotal * 0.025).toFixed(2))
          
          console.log('Delivery - Revenue calculation:', {
            productSubtotal,
            sellerEarnings: `${sellerEarnings} (97.5%)`,
            platformCommission: `${platformCommission} (2.5%)`
          })
          
          console.log(`✅ Order delivered - ₹${sellerEarnings} moved from pending to available`)
          console.log('Note: Wallet balances are calculated dynamically from order status')
          
          // Ensure wallet exists
          const { data: existingWallet } = await supabase
            .from('wallets')
            .select('id')
            .eq('seller_id', order.seller_id)
            .single()

          if (!existingWallet) {
            await supabase
              .from('wallets')
              .insert({
                seller_id: order.seller_id,
                pending_balance: 0,
                available_balance: 0,
                total_earned: 0
              })
          }
          
          // Record admin earnings when order is delivered
          // Admin gets: 2.5% from seller + 2.5% service charge from buyer + delivery fees
          try {
            const buyerServiceCharge = parseFloat((productSubtotal * 0.025).toFixed(2)) // 2.5% from buyer
            const deliveryFee = parseFloat(order.delivery_fee || 0)
            const totalAdminEarnings = platformCommission + buyerServiceCharge + deliveryFee
            
            console.log('Admin earnings calculation:', {
              sellerCommission: `${platformCommission} (2.5% from seller)`,
              buyerServiceCharge: `${buyerServiceCharge} (2.5% from buyer)`,
              deliveryFee: `${deliveryFee} (100% delivery)`,
              totalAdminEarnings
            })
            
            await supabase
              .from('admin_earnings')
              .insert({
                order_id: id,
                seller_id: order.seller_id,
                commission_amount: totalAdminEarnings,
                commission_rate: 5.0, // Combined 5% (2.5% + 2.5%)
                order_amount: productSubtotal,
                delivery_fee: deliveryFee,
                status: 'earned',
                earned_at: new Date().toISOString()
              })
            
            console.log('✅ Admin earnings recorded')
          } catch (adminEarningsError) {
            console.error('Error recording admin earnings:', adminEarningsError)
            // Don't fail the delivery process
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
