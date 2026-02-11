import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/reviews - Get reviews for a product
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    const { data: reviews, error } = await supabase
      .from('product_ratings')
      .select(`
        *,
        users:user_id (
          id,
          name,
          profile_photo
        )
      `)
      .eq('product_id', productId)
      .order('date', { ascending: false })

    if (error) {
      console.error('Error fetching reviews:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(reviews || [])
  } catch (error) {
    console.error('Error in reviews API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/reviews - Create a new review
export async function POST(request) {
  try {
    const { requireAuth, getUserBySupabaseAuthId } = await import('@/lib/auth')
    const session = await requireAuth(request)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserBySupabaseAuthId(session.user.id)
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { product_id, rating, review, title } = body

    if (!product_id || !rating) {
      return NextResponse.json({ error: 'Product ID and rating are required' }, { status: 400 })
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
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
      .eq('order_items.product_id', product_id)

    if (orderError) {
      console.error('Error checking order:', orderError)
      return NextResponse.json({ error: 'Failed to verify purchase' }, { status: 500 })
    }

    if (!deliveredOrders || deliveredOrders.length === 0) {
      return NextResponse.json({ 
        error: 'You can only review products you have purchased and received' 
      }, { status: 403 })
    }

    // Check if user already reviewed this product
    const { data: existingReview } = await supabase
      .from('product_ratings')
      .select('id')
      .eq('product_id', product_id)
      .eq('user_id', user.id)
      .single()

    if (existingReview) {
      return NextResponse.json({ error: 'You have already reviewed this product' }, { status: 400 })
    }

    const reviewData = {
      product_id,
      user_id: user.id,
      rating,
      review: review || null,
      title: title || null,
      date: new Date().toISOString()
    }

    const { data: newReview, error } = await supabase
      .from('product_ratings')
      .insert(reviewData)
      .select()
      .single()

    if (error) {
      console.error('Error creating review:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(newReview, { status: 201 })
  } catch (error) {
    console.error('Error in reviews API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
