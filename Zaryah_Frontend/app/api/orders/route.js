// Next.js API route for orders
import { NextResponse } from 'next/server'
import { requireRole, getBuyerId, getSellerId, requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getShipmentTracking, getShipmentDetails, mapShiprocketStatus } from '@/lib/shiprocket'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function getPassiveSyncStatus(mappedStatus) {
  return ['confirmed', 'dispatched'].includes(mappedStatus) ? mappedStatus : null
}

function getDisplayStatus(order) {
  const mappedStatus = mapShiprocketStatus(order?.shipment_status).status

  if (order?.status === 'cancelled' && mappedStatus && mappedStatus !== 'cancelled') {
    return mappedStatus
  }

  return order?.status
}

// GET /api/orders - Get orders (buyer, seller, or admin)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const userType = searchParams.get('userType') // buyer, seller, or admin
    const statusFilter = searchParams.get('status')
    const paginated = searchParams.get('paginated') === 'true'
    const requestedPage = parseInt(searchParams.get('page') || '1', 10)
    const requestedPageSize = parseInt(searchParams.get('pageSize') || '20', 10)
    const page = Number.isNaN(requestedPage) ? 1 : Math.max(1, requestedPage)
    const pageSize = Number.isNaN(requestedPageSize) ? 20 : Math.min(100, Math.max(5, requestedPageSize))
    
    // Get authenticated user
    const session = await requireAuth(request)
    const user = await getUserBySupabaseAuthId(session.user.id)
    
    if (!user) {
      throw new Error('User not found')
    }

    // Fetch base orders without embedded relations to avoid ambiguous FK issues
    let query = supabase
      .from('orders')
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
            category
          )
        ),
        sellers!seller_id (
          id,
          business_name,
          full_name,
          primary_mobile,
          business_address,
          city
        ),
        buyers!buyer_id (
          id,
          city,
          address
        )
      `)
      .order('created_at', { ascending: false })

    // Filter based on user type
    let isSeller = false
    if (userType === 'buyer' || user.user_type === 'Buyer') {
      query = query.eq('buyer_id', user.id)
    } else if (userType === 'seller' || user.user_type === 'Seller') {
      query = query.eq('seller_id', user.id)
      isSeller = true
    } else if (user.user_type !== 'Admin') {
      // Non-admin users can only see their own orders
      if (user.user_type === 'Buyer') {
        query = query.eq('buyer_id', user.id)
      } else if (user.user_type === 'Seller') {
        query = query.eq('seller_id', user.id)
        isSeller = true
      }
    }
    // Admin can see all orders (no filter)

    // Hide unpaid online orders for sellers only - buyers can see all their orders
    if (isSeller) {
      query = query.or('payment_method.eq.cod,payment_status.eq.paid')
    }

    // Optional status filter for list views
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    // Optional pagination
    if (paginated) {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)
    }

    const { data: orders, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fail-safe reconciliation: if webhook was missed, refresh active shipment statuses
    if (orders && orders.length > 0) {
      const reconcilableOrders = orders
        .filter(order =>
          order?.awb_code &&
          !['delivered', 'cancelled'].includes(order.status) &&
          !['delivered', 'cancelled', 'rto_delivered'].includes((order.shipment_status || '').toLowerCase())
        )
        .slice(0, 10)

      if (reconcilableOrders.length > 0) {
        await Promise.all(reconcilableOrders.map(async (order) => {
          try {
            const trackingData = await getShipmentTracking(order.awb_code)
            const tracking = trackingData?.tracking_data || trackingData || {}
            const liveStatus = tracking.shipment_status || tracking.current_status || order.shipment_status

            if (!liveStatus || liveStatus === order.shipment_status) {
              return
            }

            const mapped = mapShiprocketStatus(liveStatus)
            const updates = {
              shipment_status: liveStatus
            }

            const passiveStatus = getPassiveSyncStatus(mapped.status)
            if (passiveStatus && passiveStatus !== order.status) {
              updates.status = passiveStatus
            }

            await supabase
              .from('orders')
              .update(updates)
              .eq('id', order.id)

            order.shipment_status = updates.shipment_status
            if (updates.status) {
              order.status = updates.status
            }
          } catch (syncError) {
            console.warn('Order status reconciliation skipped for order:', order.id, syncError.message)
          }
        }))
      }

      const shipmentOnlyOrders = orders
        .filter(order =>
          order?.shipment_id &&
          !order?.awb_code &&
          !['delivered', 'cancelled'].includes(order.status)
        )
        .slice(0, 10)

      if (shipmentOnlyOrders.length > 0) {
        await Promise.all(shipmentOnlyOrders.map(async (order) => {
          try {
            const shipment = await getShipmentDetails(order.shipment_id)
            const mapped = mapShiprocketStatus(shipment?.status)
            const updates = {}

            if (shipment?.awbCode) {
              updates.awb_code = shipment.awbCode
              updates.tracking_url = `https://shiprocket.co/tracking/${shipment.awbCode}`
            }

            if (shipment?.courierName) {
              updates.courier_name = shipment.courierName
            }

            if (shipment?.status !== undefined && shipment?.status !== null) {
              updates.shipment_status = String(shipment.status)
            }

            const passiveStatus = getPassiveSyncStatus(mapped.status)
            if (passiveStatus && passiveStatus !== order.status) {
              updates.status = passiveStatus
            }

            if (Object.keys(updates).length === 0) {
              return
            }

            await supabase
              .from('orders')
              .update(updates)
              .eq('id', order.id)

            Object.assign(order, updates)
          } catch (syncError) {
            console.warn('Shipment-id reconciliation skipped for order:', order.id, syncError.message)
          }
        }))
      }
    }

    // Log shipping/courier fields for debugging
    console.log('📦 Orders API - Sample order data (first order):')
    if (orders && orders.length > 0) {
      const sampleOrder = orders[0]
      console.log({
        id: sampleOrder.id?.slice(0, 8),
        status: sampleOrder.status,
        shipment_id: sampleOrder.shipment_id,
        courier_name: sampleOrder.courier_name,
        awb_code: sampleOrder.awb_code,
        tracking_url: sampleOrder.tracking_url,
        allFields: Object.keys(sampleOrder)
      })
    }

    const headers = {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0'
    }

    const normalizedOrders = (orders || []).map(order => ({
      ...order,
      display_status: getDisplayStatus(order)
    }))

    if (!paginated) {
      return NextResponse.json(normalizedOrders, {
        headers
      })
    }

    // Count query for pagination metadata
    let countQuery = supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })

    let countIsSeller = false
    if (userType === 'buyer' || user.user_type === 'Buyer') {
      countQuery = countQuery.eq('buyer_id', user.id)
    } else if (userType === 'seller' || user.user_type === 'Seller') {
      countQuery = countQuery.eq('seller_id', user.id)
      countIsSeller = true
    } else if (user.user_type !== 'Admin') {
      if (user.user_type === 'Buyer') {
        countQuery = countQuery.eq('buyer_id', user.id)
      } else if (user.user_type === 'Seller') {
        countQuery = countQuery.eq('seller_id', user.id)
        countIsSeller = true
      }
    }

    if (countIsSeller) {
      countQuery = countQuery.or('payment_method.eq.cod,payment_status.eq.paid')
    }

    if (statusFilter && statusFilter !== 'all') {
      countQuery = countQuery.eq('status', statusFilter)
    }

    const { count, error: countError } = await countQuery
    if (countError) {
      console.warn('Orders count query failed:', countError.message)
    }

    const totalCount = typeof count === 'number' ? count : (orders?.length || 0)
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    return NextResponse.json({
      orders: normalizedOrders,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0'
      }
    })
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching orders:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/orders - Create new order (buyer only)
export async function POST(request) {
  try {
    console.log('=== Order Creation Started ===')
    const { user } = await requireRole(request, 'Buyer')
    console.log('User authenticated:', user.id, user.user_type)
    const buyerId = user.id
    const body = await request.json()
    console.log('Request body:', JSON.stringify(body, null, 2))
    const { 
      items, 
      address, 
      paymentMethod, 
      paymentId, 
      totalAmount: frontendTotal,
      deliveryFee,
      giftPackagingFee,
      codFee,
      platformFee
    } = body

    console.log('Order breakdown from frontend:', {
      totalAmount: frontendTotal,
      deliveryFee,
      giftPackagingFee,
      codFee,
      platformFee
    })

    if (!items || items.length === 0) {
      console.error('Cart is empty')
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }

    console.log(`Processing ${items.length} items...`)

    // Calculate subtotal from products
    let subtotal = 0
    const orderItems = []

    for (const item of items) {
      console.log(`Fetching product: ${item.productId}`)
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('price, seller_id, stock')
        .eq('id', item.productId)
        .single()

      if (productError) {
        console.error('Product query error:', productError)
        return NextResponse.json({ error: `Database error: ${productError.message}` }, { status: 500 })
      }

      if (!product) {
        console.error(`Product not found: ${item.productId}`)
        return NextResponse.json({ error: `Product ${item.productId} not found` }, { status: 404 })
      }

      console.log(`Product found: ${item.productId}, price: ${product.price}, stock: ${product.stock}`)

      if (product.stock < item.quantity) {
        console.error(`Insufficient stock for product ${item.productId}: available=${product.stock}, requested=${item.quantity}`)
        return NextResponse.json({ error: `Insufficient stock for product ${item.productId}` }, { status: 400 })
      }

      const itemTotal = parseFloat(product.price) * item.quantity
      subtotal += itemTotal

      orderItems.push({
        product_id: item.productId,
        quantity: item.quantity,
        price: product.price,
        gift_packaging: item.giftPackaging || false,
        customizations: item.customizations || [],
        seller_id: product.seller_id
      })
    }

    // Use frontend total if provided (includes delivery, gift packaging, COD fees)
    // Otherwise calculate from subtotal
    const totalAmount = frontendTotal || subtotal
    
    // Calculate commission breakdown
    const sellerCommission = parseFloat((subtotal * 0.025).toFixed(2)) // 2.5% from seller
    const buyerPlatformFee = parseFloat(platformFee || 0) // Platform fee from buyer (₹10 or ₹20)
    const sellerProductShare = parseFloat((subtotal * 0.975).toFixed(2)) // Seller gets 97.5% of products
    const giftPackagingTotal = parseFloat(giftPackagingFee || 0) // Gift fees go 100% to seller
    const sellerAmount = parseFloat((sellerProductShare + giftPackagingTotal).toFixed(2)) // Total seller earnings
    
    console.log(`Product subtotal: ${subtotal}`)
    console.log(`Gift packaging fees: ${giftPackagingTotal} (100% to seller)`)
    console.log(`Total order amount (with fees): ${totalAmount}`)
    console.log(`Commission breakdown: Seller commission (2.5%)=${sellerCommission}, Buyer Platform Fee=${buyerPlatformFee}`)
    console.log(`Seller earnings: ${sellerAmount} (97.5% of products + 100% of gift fees)`)
    console.log(`Order items count: ${orderItems.length}`)

    // Get seller ID (assuming all items are from same seller, or handle multiple sellers)
    const sellerId = orderItems[0].seller_id
    console.log(`Seller ID: ${sellerId}`)

    // Create order
    console.log('Creating order record...')
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_id: buyerId,
        seller_id: sellerId,
        total_amount: totalAmount,
        address: address,
        payment_method: paymentMethod || 'cod',
        payment_id: paymentId || null,
        payment_status: paymentMethod === 'cod' ? 'pending' : 'pending',
        status: 'pending',
        delivery_fee: deliveryFee || 0,
        gift_packaging_fee: giftPackagingTotal, // Gift packaging fees (100% to seller)
        platform_fee: buyerPlatformFee, // ₹10 or ₹20 platform fee from buyer
        commission_amount: sellerCommission, // 2.5% seller commission only
        seller_amount: sellerAmount // 97.5% of products + 100% gift fees
      })
      .select()
      .single()

    if (orderError) {
      console.error('Order creation error:', orderError)
      return NextResponse.json({ error: orderError.message }, { status: 400 })
    }

    console.log('Order created successfully:', order.id)

    // Create order items
    console.log('Creating order items...')
    const orderItemsData = orderItems.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      price: item.price,
      gift_packaging: item.gift_packaging,
      customizations: item.customizations
    }))

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsData)

    if (itemsError) {
      // Rollback order creation
      await supabase.from('orders').delete().eq('id', order.id)
      return NextResponse.json({ error: itemsError.message }, { status: 400 })
    }

    // Update product stock (try RPC first, fallback to direct update)
    for (const item of items) {
      try {
        await supabase.rpc('decrement_stock', {
          product_id: item.productId,
          quantity: item.quantity
        })
      } catch (rpcError) {
        // Fallback if RPC doesn't exist
        const { data: product } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.productId)
          .single()

        if (product) {
          await supabase
            .from('products')
            .update({ stock: product.stock - item.quantity })
            .eq('id', item.productId)
        }
      }
    }

    // Clear cart
    console.log('Clearing cart...')
    const { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('buyer_id', buyerId)
      .single()

    if (cart) {
      await supabase
        .from('cart_items')
        .delete()
        .eq('cart_id', cart.id)
      console.log('Cart cleared')
    }

    // Update seller wallet - add to pending balance for COD orders only
    // Online orders will be credited during payment verification
    if (paymentMethod === 'cod') {
      console.log('Updating seller wallet (COD order)...')
      const sellerEarnings = parseFloat(order.seller_amount || 0) // Use seller_amount from order (includes gift fees)
      const platformCommission = parseFloat((subtotal * 0.025).toFixed(2)) // 2.5% from seller
      
      console.log('💰 SELLER EARNINGS CALCULATED:')
      console.log('  Product subtotal:', `₹${subtotal}`)
      console.log('  Gift packaging fees:', `₹${giftPackagingTotal}`)
      console.log('  Seller earnings (97.5% + gift fees):', `₹${sellerEarnings}`)
      console.log('  Platform commission (2.5%):', `₹${platformCommission}`)
      
      // Ensure wallet exists and update pending balance
      const { data: existingWallet } = await supabase
        .from('wallets')
        .select('id, pending_balance')
        .eq('seller_id', sellerId)
        .single()

      if (!existingWallet) {
        console.log('  Creating wallet record for seller')
        await supabase
          .from('wallets')
          .insert({
            seller_id: sellerId,
            pending_balance: sellerEarnings, // Add to pending immediately
            available_balance: 0,
            total_earned: 0
          })
      } else {
        // Update existing wallet - add to pending balance
        const currentPending = parseFloat(existingWallet.pending_balance || 0)
        await supabase
          .from('wallets')
          .update({
            pending_balance: currentPending + sellerEarnings,
            updated_at: new Date().toISOString()
          })
          .eq('seller_id', sellerId)
      }
      
      console.log(`✅ COD Order created - ₹${sellerEarnings} added to seller's pending balance`)

      // Create transaction record
      await supabase
        .from('transactions')
        .insert({
          seller_id: sellerId,
          order_id: order.id,
          type: 'credit_pending',
          amount: sellerEarnings,
          status: 'completed',
          description: `COD Order #${order.id.substring(0, 8)} - Pending delivery confirmation`
        })
    } else {
      console.log('Online payment order - wallet will be credited after payment verification')
    }

    // Fetch complete order with relations
    console.log('Fetching complete order details...')
    const { data: completeOrder } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          products:product_id (*)
        )
      `)
      .eq('id', order.id)
      .single()

    console.log('=== Order Creation Completed Successfully ===')
    return NextResponse.json({ order: completeOrder || order }, { status: 201 })
  } catch (error) {
    console.error('=== Order Creation Failed ===')
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: error.message === 'Unauthorized' ? 401 : 403 })
    }
    if (error.message === 'User not found in database') {
      return NextResponse.json({ error: 'User profile not found. Please complete your profile.' }, { status: 403 })
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}






