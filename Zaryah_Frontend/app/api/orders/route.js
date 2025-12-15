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
      .select('*')
      .order('created_at', { ascending: false })

    // Filter based on user type
    if (userType === 'buyer' || user.user_type === 'Buyer') {
      query = query.eq('buyer_id', user.id)
    } else if (userType === 'seller' || user.user_type === 'Seller') {
      query = query.eq('seller_id', user.id)
    } else if (user.user_type !== 'Admin') {
      // Non-admin users can only see their own orders
      if (user.user_type === 'Buyer') {
        query = query.eq('buyer_id', user.id)
      } else if (user.user_type === 'Seller') {
        query = query.eq('seller_id', user.id)
      }
    }
    // Admin can see all orders (no filter)

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
    const { user } = await requireRole(request, 'Buyer')
    const buyerId = user.id
    const body = await request.json()
    const { items, address, paymentMethod, paymentId } = body

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }

    // Calculate total amount
    let totalAmount = 0
    const orderItems = []

    for (const item of items) {
      const { data: product } = await supabase
        .from('products')
        .select('price, seller_id, stock')
        .eq('id', item.productId)
        .single()

      if (!product) {
        return NextResponse.json({ error: `Product ${item.productId} not found` }, { status: 404 })
      }

      if (product.stock < item.quantity) {
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

    // Get seller ID (assuming all items are from same seller, or handle multiple sellers)
    const sellerId = orderItems[0].seller_id

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_id: buyerId,
        seller_id: sellerId,
        total_amount: totalAmount,
        address: address,
        payment_method: paymentMethod || 'cod',
        payment_id: paymentId || null,
        status: 'pending'
      })
      .select()
      .single()

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 400 })
    }

    // Create order items
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
    }

    // Fetch complete order with relations
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

    return NextResponse.json(completeOrder, { status: 201 })
  } catch (error) {
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: error.message === 'Unauthorized' ? 401 : 403 })
    }
    console.error('Error creating order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}






