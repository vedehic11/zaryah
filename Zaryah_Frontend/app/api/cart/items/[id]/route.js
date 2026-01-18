// Next.js API route for individual cart item operations
import { NextResponse } from 'next/server'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// PUT /api/cart/items/[id] - Update cart item quantity or options
export async function PUT(request, { params }) {
  try {
    const { id } = await params
    const session = await requireAuth(request)
    const user = await getUserBySupabaseAuthId(session.user.id)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { quantity, giftPackaging, customizations } = body

    // Verify item belongs to user's cart
    const { data: item, error: itemError } = await supabase
      .from('cart_items')
      .select(`
        id,
        product_id,
        cart_id,
        carts!inner (
          buyer_id
        )
      `)
      .eq('id', id)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: 'Cart item not found' }, { status: 404 })
    }

    if (item.carts.buyer_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // If updating quantity, check stock
    if (quantity !== undefined) {
      const { data: product } = await supabase
        .from('products')
        .select('stock')
        .eq('id', item.product_id)
        .single()

      if (!product || product.stock < quantity) {
        return NextResponse.json({ error: 'Insufficient stock' }, { status: 400 })
      }
    }

    // Update item
    const updates = {}
    if (quantity !== undefined) updates.quantity = quantity
    if (giftPackaging !== undefined) updates.gift_packaging = giftPackaging
    if (customizations !== undefined) updates.customizations = customizations

    const { data: updatedItem, error: updateError } = await supabase
      .from('cart_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Cart item updated',
      item: updatedItem 
    })

  } catch (error) {
    console.error('Error updating cart item:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/cart/items/[id] - Remove item from cart
export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    const session = await requireAuth(request)
    const user = await getUserBySupabaseAuthId(session.user.id)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify item belongs to user's cart
    const { data: item, error: itemError } = await supabase
      .from('cart_items')
      .select(`
        id,
        carts!inner (
          buyer_id
        )
      `)
      .eq('id', id)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: 'Cart item not found' }, { status: 404 })
    }

    if (item.carts.buyer_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Delete item
    const { error: deleteError } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Item removed from cart' })

  } catch (error) {
    console.error('Error deleting cart item:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
