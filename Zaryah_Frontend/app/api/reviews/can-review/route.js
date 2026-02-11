import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/reviews/can-review?productId=xxx - Check if user can review a product
export async function GET(request) {
  try {
    const { requireAuth, getUserBySupabaseAuthId } = await import('@/lib/auth')
    const session = await requireAuth(request)
    
    if (!session?.user) {
      return NextResponse.json({ canReview: false, reason: 'Not authenticated' })
    }

    const user = await getUserBySupabaseAuthId(session.user.id)
    
    if (!user) {
      return NextResponse.json({ canReview: false, reason: 'User not found' })
    }

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    // Check if user has already reviewed this product
    const { data: existingReview } = await supabase
      .from('product_ratings')
      .select('id')
      .eq('product_id', productId)
      .eq('user_id', user.id)
      .single()

    if (existingReview) {
      return NextResponse.json({ 
        canReview: false, 
        reason: 'Already reviewed' 
      })
    }

    // Check if user has purchased and received this product
    const { data: deliveredOrders, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        status,
        order_items!inner (
          product_id
        )
      `)
      .eq('buyer_id', user.id)
      .eq('status', 'delivered')
      .eq('order_items.product_id', productId)

    if (orderError) {
      console.error('Error checking order:', orderError)
      return NextResponse.json({ error: 'Failed to verify purchase' }, { status: 500 })
    }

    if (!deliveredOrders || deliveredOrders.length === 0) {
      return NextResponse.json({ 
        canReview: false, 
        reason: 'Must purchase and receive product first' 
      })
    }

    return NextResponse.json({ 
      canReview: true,
      orderId: deliveredOrders[0].id 
    })
  } catch (error) {
    console.error('Error in can-review API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
