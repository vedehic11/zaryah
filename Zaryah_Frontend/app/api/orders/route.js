// Next.js API route for orders
import { NextResponse } from 'next/server'
import { requireRole, getBuyerId, getSellerId } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// GET /api/orders - Get orders (buyer, seller, or admin)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const userType = searchParams.get('userType') // buyer, seller, or admin
    
    // Get authenticated user
    const { requireAuth: requireAuthHelper, getUserBySupabaseAuthId } = await import('@/lib/auth')
    const session = await requireAuthHelper(request)
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

    const { data: orders, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(orders)
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
    const { items, address, paymentMethod, paymentId } = body

    if (!items || items.length === 0) {
      console.error('Cart is empty')
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }

    console.log(`Processing ${items.length} items...`)

    // Calculate total amount
    let totalAmount = 0
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
      totalAmount += itemTotal

      orderItems.push({
        product_id: item.productId,
        quantity: item.quantity,
        price: product.price,
        gift_packaging: item.giftPackaging || false,
        customizations: item.customizations || [],
        seller_id: product.seller_id
      })
    }

    console.log(`Total order amount: ${totalAmount}`)
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
        status: 'pending'
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






