// Next.js API route for cart operations
import { NextResponse } from 'next/server'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// GET /api/cart - Get user's cart
export async function GET(request) {
  try {
    const session = await requireAuth(request)
    const user = await getUserBySupabaseAuthId(session.user.id)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Fetch cart with items and product details
    const { data: cart, error: cartError } = await supabase
      .from('carts')
      .select(`
        id,
        buyer_id,
        created_at,
        updated_at
      `)
      .eq('buyer_id', user.id)
      .single()

    // If no cart exists, create one
    if (cartError && cartError.code === 'PGRST116') {
      const { data: newCart, error: createError } = await supabase
        .from('carts')
        .insert({ buyer_id: user.id })
        .select()
        .single()

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 })
      }

      return NextResponse.json({
        id: newCart.id,
        buyer_id: newCart.buyer_id,
        items: [],
        total: 0
      })
    }

    if (cartError) {
      return NextResponse.json({ error: cartError.message }, { status: 500 })
    }

    // Fetch cart items with product details
    const { data: items, error: itemsError } = await supabase
      .from('cart_items')
      .select(`
        id,
        cart_id,
        product_id,
        quantity,
        gift_packaging,
        customizations,
        created_at,
        products (
          id,
          name,
          description,
          price,
          images,
          stock,
          seller_id,
          instant_delivery,
          sellers:seller_id (
            business_name,
            full_name
          )
        )
      `)
      .eq('cart_id', cart.id)

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    // Calculate total
    const total = (items || []).reduce((sum, item) => {
      const price = item.products?.price || 0
      return sum + (price * item.quantity)
    }, 0)

    return NextResponse.json({
      id: cart.id,
      buyer_id: cart.buyer_id,
      items: items || [],
      total
    })

  } catch (error) {
    console.error('Error fetching cart:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/cart - Add item to cart
export async function POST(request) {
  try {
    const session = await requireAuth(request)
    const user = await getUserBySupabaseAuthId(session.user.id)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { productId, quantity = 1, giftPackaging = false, customizations = [] } = body

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    // Verify product exists and has stock
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, price, stock, name')
      .eq('id', productId)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    if (product.stock < quantity) {
      return NextResponse.json({ error: 'Insufficient stock' }, { status: 400 })
    }

    // Get or create cart
    let { data: cart, error: cartError } = await supabase
      .from('carts')
      .select('id')
      .eq('buyer_id', user.id)
      .single()

    if (cartError && cartError.code === 'PGRST116') {
      const { data: newCart, error: createError } = await supabase
        .from('carts')
        .insert({ buyer_id: user.id })
        .select()
        .single()

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 })
      }
      cart = newCart
    }

    // Check if item already exists in cart
    const { data: existingItem } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('cart_id', cart.id)
      .eq('product_id', productId)
      .single()

    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + quantity

      if (product.stock < newQuantity) {
        return NextResponse.json({ error: 'Insufficient stock' }, { status: 400 })
      }

      const { data: updatedItem, error: updateError } = await supabase
        .from('cart_items')
        .update({ 
          quantity: newQuantity,
          gift_packaging: giftPackaging,
          customizations
        })
        .eq('id', existingItem.id)
        .select()
        .single()

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({ 
        message: 'Cart updated',
        item: updatedItem 
      })
    }

    // Add new item
    const { data: newItem, error: insertError } = await supabase
      .from('cart_items')
      .insert({
        cart_id: cart.id,
        product_id: productId,
        quantity,
        gift_packaging: giftPackaging,
        customizations
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Item added to cart',
      item: newItem 
    }, { status: 201 })

  } catch (error) {
    console.error('Error adding to cart:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/cart - Clear entire cart
export async function DELETE(request) {
  try {
    const session = await requireAuth(request)
    const user = await getUserBySupabaseAuthId(session.user.id)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get cart
    const { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('buyer_id', user.id)
      .single()

    if (!cart) {
      return NextResponse.json({ message: 'Cart already empty' })
    }

    // Delete all items
    const { error: deleteError } = await supabase
      .from('cart_items')
      .delete()
      .eq('cart_id', cart.id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Cart cleared successfully' })

  } catch (error) {
    console.error('Error clearing cart:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
