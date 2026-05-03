// API route for updating individual order
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'

function parseDeliveryAddress(order, buyer) {
  if (typeof order.address === 'string') {
    const addressParts = order.address.split(',').map(s => s.trim())
    const phoneMatch = order.address.match(/Phone:\s*(\d+)/)
    const phone = phoneMatch ? phoneMatch[1] : buyer?.phone

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

    return {
      name,
      address: streetAddress,
      city,
      state,
      pincode,
      phone,
      email: buyer?.email || 'customer@zaryah.com'
    }
  }

  if (typeof order.address === 'object' && order.address !== null) {
    return {
      name: order.address.name || order.address.fullName || 'Customer',
      address: order.address.address || order.address.streetAddress || '',
      city: order.address.city || '',
      state: order.address.state || '',
      pincode: order.address.pincode || order.address.zipCode || '',
      phone: order.address.phone || order.address.mobile || buyer?.phone || '',
      email: order.address.email || buyer?.email || 'customer@zaryah.com'
    }
  }

  throw new Error('Invalid address format in order')
}

function buildSellerDeliveryAddress(seller) {
  const fallbackAddress = seller?.city && seller?.state && seller?.pincode
    ? `${seller.city}, ${seller.state} - ${seller.pincode}`
    : ''

  return {
    name: seller?.full_name || seller?.business_name || 'Seller',
    address: (seller?.business_address || '').trim() || fallbackAddress,
    city: seller?.city || '',
    state: seller?.state || '',
    pincode: seller?.pincode || '',
    phone: seller?.primary_mobile || '',
    email: seller?.email || 'seller@zaryah.com'
  }
}

function buildSellerPickupLocation(seller, orderId) {
  const fallbackAddress = seller?.city && seller?.state && seller?.pincode
    ? `${seller.city}, ${seller.state} - ${seller.pincode}`
    : ''

  const pickupLocationName = seller?.business_name
    ? `${seller.business_name.substring(0, 20)}_${orderId.substring(0, 8)}`
    : `Seller_${orderId.substring(0, 8)}`

  return {
    name: pickupLocationName,
    contactName: seller?.full_name || seller?.business_name || 'Seller',
    phone: seller?.primary_mobile || '',
    address: (seller?.business_address || '').trim() || fallbackAddress,
    city: seller?.city || '',
    state: seller?.state || '',
    pincode: seller?.pincode || '',
    email: seller?.email || 'seller@zaryah.com'
  }
}

function buildBuyerPickupLocation(buyerAddress, orderId) {
  return {
    name: `Buyer_${orderId.substring(0, 8)}`,
    contactName: buyerAddress.name || 'Customer',
    phone: buyerAddress.phone || '',
    address: buyerAddress.address || '',
    city: buyerAddress.city || '',
    state: buyerAddress.state || '',
    pincode: buyerAddress.pincode || '',
    email: buyerAddress.email || 'customer@zaryah.com'
  }
}

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
    const validStatuses = ['pending', 'confirmed', 'pickup_dispatched', 'received_by_seller', 'ready', 'dispatched', 'delivered', 'cancelled']
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

    const shipmentFailed = typeof order.notes === 'string' && order.notes.includes('SHIPMENT ERROR')
    
    console.log('Order found - current status:', order.status, '- requested:', status)

    // VALIDATION: Check if status transition is allowed
    // Allow idempotent operations (setting same status again)
    if (order.status === status) {
      console.log(`Status already ${status}, allowing idempotent operation`)
      // Continue to process (useful for retry scenarios like shipment creation)
    } else {
      // Check valid transitions for different statuses
      const validTransitions = {
        'pending': ['confirmed', 'cancelled'],
        'confirmed': order.two_way_delivery ? ['pickup_dispatched', 'cancelled'] : ['ready', 'cancelled'],
        'pickup_dispatched': ['received_by_seller', 'cancelled'],
        'received_by_seller': ['ready', 'cancelled'],
        'ready': ['dispatched', 'cancelled'],
        'dispatched': ['delivered', 'cancelled'],
        'delivered': [],
        'cancelled': []
      }

      const allowedNextStatuses = validTransitions[order.status] || []
      if (!allowedNextStatuses.includes(status)) {
        console.error(`Invalid status transition: ${order.status} -> ${status}`)
        return NextResponse.json({ 
          error: 'Invalid status transition',
          message: `Cannot change status from "${order.status}" to "${status}". Allowed: ${allowedNextStatuses.join(', ') || 'none'}`
        }, { status: 400 })
      }
    }

    // Check permissions: Seller can update orders they own, Admin can update any
    if (user.user_type === 'Seller' && order.seller_id !== user.id) {
      console.error('Permission denied - seller_id mismatch')
      return NextResponse.json({ error: 'Forbidden - You can only update your own orders' }, { status: 403 })
    }

    if (user.user_type === 'Buyer') {
      if (order.buyer_id !== user.id) {
        console.error('Permission denied - buyer_id mismatch')
        return NextResponse.json({ error: 'Forbidden - You can only update your own orders' }, { status: 403 })
      }

      if (status !== 'cancelled') {
        console.error('Permission denied - buyers can only cancel orders')
        return NextResponse.json({ error: 'Forbidden - Buyers can only cancel orders' }, { status: 403 })
      }

      if (!['pending', 'confirmed', 'pickup_dispatched', 'received_by_seller', 'ready'].includes(order.status) && order.status !== 'cancelled') {
        return NextResponse.json({
          error: 'Order already shipped. Cancellation is not allowed now. Please deny delivery if needed.'
        }, { status: 400 })
      }

      const shipmentStatusText = String(order.shipment_status || '').toUpperCase()
      const isLikelyShipped =
        !!order.awb_code ||
        order.status === 'dispatched' ||
        shipmentStatusText.includes('SHIP') ||
        shipmentStatusText.includes('TRANSIT') ||
        shipmentStatusText.includes('OUT FOR DELIVERY')

      if (status === 'cancelled' && isLikelyShipped) {
        return NextResponse.json({
          error: 'Order already shipped. Cancellation is not allowed now. Please deny delivery if needed.'
        }, { status: 400 })
      }
    }
    
    // Sellers can only confirm orders and mark COD orders as delivered
    // Dispatched status is always automatic from shipping system
    if (user.user_type === 'Seller') {
      if (status === 'dispatched') {
        console.error('Permission denied - sellers cannot manually mark as dispatched')
        return NextResponse.json({ 
          error: 'Forbidden - Orders are automatically marked as dispatched when shipment is created and AWB is assigned by the courier.' 
        }, { status: 403 })
      }
      
      // For delivered status, only allow if it's a COD order (sellers confirm cash received)
      if (status === 'delivered' && order.payment_method !== 'cod') {
        console.error('Permission denied - only COD orders can be manually marked as delivered by seller')
        return NextResponse.json({ 
          error: 'Forbidden - Online payment orders are automatically marked as delivered by the shipping system. Only COD orders can be manually confirmed.' 
        }, { status: 403 })
      }
    }

    if (status === 'ready' && !order.two_way_delivery) {
      // Ready is allowed for standard orders to trigger shipment creation
    }

    if (['pickup_dispatched', 'received_by_seller'].includes(status) && !order.two_way_delivery) {
      return NextResponse.json({ error: `${status} status is only for two-way delivery orders.` }, { status: 400 })
    }

    if (status === 'delivered' && order.payment_method === 'online' && order.payment_status !== 'paid') {
      return NextResponse.json({
        error: 'Online payment is not completed for this order. Cannot mark as delivered.'
      }, { status: 400 })
    }

    if (status === 'dispatched') {
      if (shipmentFailed) {
        return NextResponse.json({
          error: 'Cannot mark as dispatched because shipment creation failed. Please resolve shipment first.'
        }, { status: 400 })
      }

      if (!order.shipment_id || !order.awb_code) {
        return NextResponse.json({
          error: 'Cannot mark as dispatched before shipment and AWB are available.'
        }, { status: 400 })
      }
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
          selected_size,
          selected_color,
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

    if (status === 'cancelled') {
      let notesAccumulator = order.notes || ''

      const notifyAdmins = async (title, message) => {
        try {
          const { data: adminUsers, error: adminFetchError } = await supabase
            .from('users')
            .select('id')
            .eq('user_type', 'Admin')

          if (adminFetchError) {
            console.error('Failed to fetch admin users for notification:', adminFetchError)
            return
          }

          if (!adminUsers?.length) return

          const adminNotifications = adminUsers.map((admin) => ({
            user_id: admin.id,
            user_model: 'Admin',
            title,
            message,
            type: 'order',
            related_order_id: id,
            priority: 'high',
            action_url: '/admin/dashboard?tab=payments'
          }))

          const { error: adminNotifError } = await supabase
            .from('notifications')
            .insert(adminNotifications)

          if (adminNotifError) {
            console.error('Failed to notify admins:', adminNotifError)
          }
        } catch (adminNotifyError) {
          console.error('Admin notification error:', adminNotifyError)
        }
      }

      if (order.payment_method === 'online' && order.payment_status !== 'refunded') {
        try {
          let razorpayPaymentId = order.razorpay_payment_id || null

          // Legacy fallback: some rows have payment_id populated with Razorpay payment id
          if (!razorpayPaymentId && typeof order.payment_id === 'string' && order.payment_id.startsWith('pay_')) {
            razorpayPaymentId = order.payment_id
          }

          // Last fallback: resolve from payments table
          if (!razorpayPaymentId) {
            const { data: paymentRow } = await supabase
              .from('payments')
              .select('payment_id')
              .eq('order_id', id)
              .eq('status', 'completed')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            if (paymentRow?.payment_id && String(paymentRow.payment_id).startsWith('pay_')) {
              razorpayPaymentId = paymentRow.payment_id
            }
          }

          if (!razorpayPaymentId) {
            const noPaymentIdNote = '⚠️ Refund skipped: Razorpay payment id not found. Admin needs to process manually.'
            notesAccumulator = notesAccumulator ? `${notesAccumulator}\n${noPaymentIdNote}` : noPaymentIdNote

            await supabase
              .from('orders')
              .update({ notes: notesAccumulator })
              .eq('id', id)

            updatedOrder.notes = notesAccumulator

            await notifyAdmins(
              'Buyer Cancellation Refund Pending',
              `Order #${id.slice(0, 8)} was cancelled, but Razorpay payment id was missing. Please process refund manually.`
            )

            throw new Error('Missing Razorpay payment id for refund')
          }

          const { default: Razorpay } = await import('razorpay')
          const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
          })

          const refundAmount = Math.round(parseFloat(order.total_amount || 0) * 100)
          const refund = await razorpay.payments.refund(razorpayPaymentId, {
            amount: refundAmount,
            notes: {
              reason: 'Buyer cancellation before shipment',
              order_id: id
            }
          })

          const refundNote = `💰 Refund initiated: ₹${(refundAmount / 100).toFixed(2)} (ID: ${refund.id})`
          notesAccumulator = notesAccumulator ? `${notesAccumulator}\n${refundNote}` : refundNote

          await supabase
            .from('orders')
            .update({
              payment_status: 'refunded',
              notes: notesAccumulator
            })
            .eq('id', id)

          updatedOrder.payment_status = 'refunded'
          updatedOrder.notes = notesAccumulator
        } catch (refundError) {
          if (refundError.message === 'Missing Razorpay payment id for refund') {
            // Already handled with notes + admin notification
          } else {
            console.error('Auto refund failed on buyer cancellation:', refundError)
            const refundFailNote = `⚠️ Auto-refund failed: ${refundError.message}. Admin needs to process manually.`
            notesAccumulator = notesAccumulator ? `${notesAccumulator}\n${refundFailNote}` : refundFailNote

            await supabase
              .from('orders')
              .update({ notes: notesAccumulator })
              .eq('id', id)

            updatedOrder.notes = notesAccumulator

            await notifyAdmins(
              'Buyer Cancellation Refund Failed',
              `Order #${id.slice(0, 8)} was cancelled by buyer, but Razorpay refund failed: ${refundError.message}`
            )
          }
        }
      }

      if (order.shipment_id) {
        try {
          const { cancelShiprocketOrder } = await import('@/lib/shiprocket')
          const cancelResult = await cancelShiprocketOrder({
            orderId: id,
            shipmentId: order.shipment_id
          })

          const shiprocketCancelNote = `✅ Shiprocket cancellation requested (${cancelResult.method}) at ${new Date().toISOString()}`
          notesAccumulator = notesAccumulator ? `${notesAccumulator}\n${shiprocketCancelNote}` : shiprocketCancelNote

          await supabase
            .from('orders')
            .update({
              shipment_status: 'CANCELLED',
              notes: notesAccumulator
            })
            .eq('id', id)

          updatedOrder.shipment_status = 'CANCELLED'
          updatedOrder.notes = notesAccumulator
        } catch (shiprocketCancelError) {
          console.error('Shiprocket cancellation failed:', shiprocketCancelError)

          const shiprocketFailNote = `⚠️ Shiprocket cancel failed: ${shiprocketCancelError.message}. Please cancel manually in Shiprocket dashboard.`
          notesAccumulator = notesAccumulator ? `${notesAccumulator}\n${shiprocketFailNote}` : shiprocketFailNote

          await supabase
            .from('orders')
            .update({ notes: notesAccumulator })
            .eq('id', id)

          updatedOrder.notes = notesAccumulator

          await notifyAdmins(
            'Shiprocket Cancellation Failed',
            `Order #${id.slice(0, 8)} was cancelled locally, but Shiprocket cancellation failed: ${shiprocketCancelError.message}`
          )
        }
      }

      if (order.inbound_shipment_id) {
        try {
          const { cancelShiprocketOrder } = await import('@/lib/shiprocket')
          await cancelShiprocketOrder({
            orderId: `${id}-IN`,
            shipmentId: order.inbound_shipment_id
          })
        } catch (inboundCancelError) {
          const inboundFailNote = `⚠️ Inbound pickup cancel failed: ${inboundCancelError.message}. Please cancel manually in Shiprocket dashboard.`
          notesAccumulator = notesAccumulator ? `${notesAccumulator}\n${inboundFailNote}` : inboundFailNote

          await supabase
            .from('orders')
            .update({ notes: notesAccumulator })
            .eq('id', id)

          updatedOrder.notes = notesAccumulator
        }
      }
    }

    // Push orders to Shiprocket when ready; AWB assignment can remain manual when auto mode is off.
    const autoCreateShipmentEnabled = process.env.AUTO_CREATE_SHIPMENT === 'true'
    const items = (updatedOrder.order_items || []).map(item => ({
      id: item.product_id,
      name: item.products?.name || 'Product',
      quantity: item.quantity,
      price: item.price,
      weight: item.products?.weight || 0.5
    }))

    if (status === 'confirmed') {
      if (order.two_way_delivery) {
        if (!order.inbound_shipment_id) {
          console.log('Creating inbound Shiprocket shipment...')
          try {
            const { createShipment } = await import('@/lib/shiprocket')
            const buyerAddress = parseDeliveryAddress(order, updatedOrder.buyers)
            const sellerDelivery = buildSellerDeliveryAddress(updatedOrder.sellers)
            const buyerPickup = buildBuyerPickupLocation(buyerAddress, id)

            if (!buyerAddress.city || !buyerAddress.state || !buyerAddress.pincode || !buyerAddress.phone) {
              throw new Error('Incomplete buyer pickup address. Please update your delivery address and try again.')
            }

            if (!sellerDelivery.city || !sellerDelivery.state || !sellerDelivery.pincode || !sellerDelivery.phone) {
              throw new Error('Incomplete seller delivery address. Please ask the seller to complete their profile.')
            }

            const inboundShipment = await createShipment({
              orderId: `${id}-IN`,
              orderDate: new Date(order.created_at).toISOString().split('T')[0],
              pickupLocation: buyerPickup,
              deliveryAddress: sellerDelivery,
              items,
              totalAmount: order.total_amount,
              paymentMethod: 'online',
              autoAssignAwb: autoCreateShipmentEnabled
            })

            const inboundUpdate = {
              inbound_shipment_id: inboundShipment.shipment_id,
              inbound_awb_code: inboundShipment.awb_code,
              inbound_courier_name: inboundShipment.courier_name,
              inbound_tracking_url: inboundShipment.tracking_url,
              inbound_shipment_status: inboundShipment.status,
              inbound_shipment_created_at: new Date().toISOString()
            }

            await supabase
              .from('orders')
              .update(inboundUpdate)
              .eq('id', id)

            Object.assign(updatedOrder, inboundUpdate)
          } catch (shipmentError) {
            console.error('❌ Inbound shipment creation failed:', shipmentError.message)

            await supabase
              .from('orders')
              .update({
                status: 'confirmed',
                notes: `⚠️ INBOUND SHIPMENT ERROR: ${shipmentError.message}. Please create pickup manually in Shiprocket dashboard.`
              })
              .eq('id', id)

            updatedOrder.status = 'confirmed'
            updatedOrder.notes = `⚠️ INBOUND SHIPMENT ERROR: ${shipmentError.message}. Please create pickup manually in Shiprocket dashboard.`
          }
        }
      }
    }

    if (status === 'ready') {
      console.log('=== READY STATUS HANDLER ===')
      console.log('two_way_delivery:', order.two_way_delivery)
      console.log('shipment_id:', order.shipment_id, '| type:', typeof order.shipment_id)
      console.log('inbound_shipment_id:', order.inbound_shipment_id)
      console.log('Condition check: status=ready:', true, ', two_way:', !!order.two_way_delivery, ', no_shipment:', !order.shipment_id)
      
      if (order.two_way_delivery && !order.shipment_id) {
        console.log('✅ Condition met — Creating return Shiprocket shipment...')
        console.log('Seller data:', JSON.stringify(updatedOrder.sellers, null, 2))
        console.log('Buyer data:', JSON.stringify(updatedOrder.buyers, null, 2))
        try {
          const { createShipment } = await import('@/lib/shiprocket')
          const deliveryAddress = parseDeliveryAddress(order, updatedOrder.buyers)
          const pickupLocation = buildSellerPickupLocation(updatedOrder.sellers, id)

          console.log('Parsed delivery address:', JSON.stringify(deliveryAddress, null, 2))
          console.log('Parsed pickup location:', JSON.stringify(pickupLocation, null, 2))

          if (!deliveryAddress.city || !deliveryAddress.state || !deliveryAddress.pincode || !deliveryAddress.phone) {
            throw new Error(`Incomplete delivery address for return shipment. Missing: ${[
              !deliveryAddress.city && 'city',
              !deliveryAddress.state && 'state',
              !deliveryAddress.pincode && 'pincode',
              !deliveryAddress.phone && 'phone'
            ].filter(Boolean).join(', ')}`)
          }

          if (!pickupLocation.city || !pickupLocation.state || !pickupLocation.pincode || !pickupLocation.phone) {
            throw new Error(`Incomplete seller pickup address. Missing: ${[
              !pickupLocation.city && 'city',
              !pickupLocation.state && 'state',
              !pickupLocation.pincode && 'pincode',
              !pickupLocation.phone && 'phone'
            ].filter(Boolean).join(', ')}. Please complete your profile details.`)
          }

          const shipment = await createShipment({
            orderId: id,
            orderDate: new Date(order.created_at).toISOString().split('T')[0],
            pickupLocation,
            deliveryAddress,
            items,
            totalAmount: order.total_amount,
            paymentMethod: order.payment_method,
            autoAssignAwb: autoCreateShipmentEnabled
          })

          console.log('✅ Return shipment created:', JSON.stringify(shipment, null, 2))

          const shipmentUpdate = {
            shipment_id: shipment.shipment_id,
            awb_code: shipment.awb_code,
            courier_name: shipment.courier_name,
            tracking_url: shipment.tracking_url,
            shipment_status: shipment.status,
            shipment_created_at: new Date().toISOString()
          }

          if (shipment.awb_code) {
            shipmentUpdate.status = 'dispatched'
          }

          await supabase
            .from('orders')
            .update(shipmentUpdate)
            .eq('id', id)

          Object.assign(updatedOrder, shipmentUpdate)
        } catch (shipmentError) {
          console.error('❌ Return shipment creation failed:', shipmentError.message)
          console.error('Full error:', shipmentError)
          await supabase
            .from('orders')
            .update({
              status: 'ready',
              notes: `⚠️ RETURN SHIPMENT ERROR: ${shipmentError.message}. Please create shipment manually in Shiprocket dashboard.`
            })
            .eq('id', id)

          updatedOrder.status = 'ready'
          updatedOrder.notes = `⚠️ RETURN SHIPMENT ERROR: ${shipmentError.message}. Please create shipment manually in Shiprocket dashboard.`
        }
      } else if (!order.two_way_delivery && !order.shipment_id) {
        console.log('✅ Condition met — Creating outbound Shiprocket shipment...')
        try {
          const { createShipment } = await import('@/lib/shiprocket')
          const deliveryAddress = parseDeliveryAddress(order, updatedOrder.buyers)

          if (!deliveryAddress.city || !deliveryAddress.state || !deliveryAddress.pincode || !deliveryAddress.phone) {
            throw new Error(`Incomplete delivery address. Missing: ${[
              !deliveryAddress.city && 'city',
              !deliveryAddress.state && 'state',
              !deliveryAddress.pincode && 'pincode',
              !deliveryAddress.phone && 'phone'
            ].filter(Boolean).join(', ')}`)
          }

          if (!/^\d{10}$/.test(deliveryAddress.phone)) {
            throw new Error('Invalid phone number. Must be 10 digits.')
          }

          if (!/^\d{6}$/.test(deliveryAddress.pincode)) {
            throw new Error('Invalid pincode. Must be 6 digits.')
          }

          const pickupLocation = buildSellerPickupLocation(updatedOrder.sellers, id)

          if (!pickupLocation.city || !pickupLocation.state || !pickupLocation.pincode || !pickupLocation.phone) {
            throw new Error('Incomplete seller pickup address. Please complete your profile details.')
          }

          const shipment = await createShipment({
            orderId: id,
            orderDate: new Date(order.created_at).toISOString().split('T')[0],
            pickupLocation,
            deliveryAddress,
            items,
            totalAmount: order.total_amount,
            paymentMethod: order.payment_method,
            autoAssignAwb: autoCreateShipmentEnabled
          })

          const shipmentUpdate = {
            shipment_id: shipment.shipment_id,
            awb_code: shipment.awb_code,
            courier_name: shipment.courier_name,
            tracking_url: shipment.tracking_url,
            shipment_status: shipment.status,
            shipment_created_at: new Date().toISOString()
          }

          if (shipment.awb_code) {
            shipmentUpdate.status = 'dispatched'
          }

          await supabase
            .from('orders')
            .update(shipmentUpdate)
            .eq('id', id)

          Object.assign(updatedOrder, shipmentUpdate)
        } catch (shipmentError) {
          console.error('❌ Shipment creation failed:', shipmentError.message)
          await supabase
            .from('orders')
            .update({
              status: 'ready',
              notes: `⚠️ SHIPMENT ERROR: ${shipmentError.message}. Please create shipment manually in Shiprocket dashboard or contact support.`
            })
            .eq('id', id)

          updatedOrder.status = 'ready'
          updatedOrder.shipment_error = shipmentError.message
          updatedOrder.notes = `⚠️ SHIPMENT ERROR: ${shipmentError.message}. Please create shipment manually in Shiprocket dashboard or contact support.`
        }
      } else {
        console.log('❌ Condition NOT met — skipping shipment creation')
        if (order.shipment_id) console.log('  Reason: shipment_id already exists:', order.shipment_id)
      }
    }

    if (status === 'ready' && order.status !== 'ready') {
      await supabase
        .from('notifications')
        .insert({
          user_id: order.buyer_id,
          user_model: 'Buyer',
          title: 'Order Ready for Shipment',
          message: 'Your order is ready and will be handed to the courier soon.',
          type: 'order',
          related_order_id: id,
          priority: 'low',
          action_url: '/orders'
        })
    }

    // Handle order delivery - release seller funds and update payment status
    if (status === 'delivered') {
      console.log('Processing order delivery...')
      
      try {
        if (order.wallet_credited) {
          console.log(`Order ${id} wallet release already processed, skipping duplicate credit`)
          return NextResponse.json(updatedOrder)
        }

        // When order is delivered, wallet balances update automatically
        // because they're calculated from order status
        if (order.seller_id) {
          console.log(`Order delivered for seller ${order.seller_id}`)

          const sellerEarnings = parseFloat(order.seller_amount || 0)

          if (sellerEarnings <= 0) {
            console.warn(`Skipping wallet release for order ${id} because seller_amount is invalid:`, order.seller_amount)
            return NextResponse.json(updatedOrder)
          }
          
          console.log(`✅ Order delivered - ₹${sellerEarnings} moving from pending to available`)
          
          const { error: releaseError } = await supabase
            .rpc('move_pending_to_available', {
              p_seller_id: order.seller_id,
              p_order_id: id,
              p_amount: sellerEarnings
            })

          if (releaseError) {
            console.error('Wallet fund release failed:', releaseError)
          } else {
            await supabase
              .from('orders')
              .update({ wallet_credited: true })
              .eq('id', id)

            await supabase
              .from('transactions')
              .insert({
                seller_id: order.seller_id,
                order_id: id,
                amount: sellerEarnings,
                type: 'credit_available',
                status: 'completed',
                description: `Order delivered - Funds released to available balance`
              })

            console.log('✅ Wallet updated: ₹' + sellerEarnings + ' released to available balance')
          }
          
          // Note: admin_earnings already recorded in payment/verify - no duplicate insertion needed
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
