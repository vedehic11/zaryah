import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/reviews - Get reviews for a seller
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const sellerId = searchParams.get('sellerId')

    if (!sellerId) {
      return NextResponse.json({ error: 'Seller ID is required' }, { status: 400 })
    }

    const { data: reviews, error } = await supabase
      .from('seller_reviews')
      .select('*')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching reviews:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const userIds = Array.from(
      new Set((reviews || []).map(review => review.user_id).filter(Boolean))
    )

    let usersById = {}
    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, profile_photo')
        .in('id', userIds)

      if (usersError) {
        console.error('Error fetching review users:', usersError)
      } else {
        usersById = (users || []).reduce((acc, user) => {
          acc[user.id] = user
          return acc
        }, {})
      }
    }

    const normalized = (reviews || []).map(review => ({
      id: review.id,
      seller_id: review.seller_id,
      user_id: review.user_id,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      images: review.images || [],
      createdAt: review.created_at,
      user: usersById[review.user_id] || {}
    }))

    return NextResponse.json(normalized)
  } catch (error) {
    console.error('Error in reviews API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/reviews - Create a new seller review
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
    const { seller_id, rating, review, title, images = [] } = body

    if (!seller_id || !rating) {
      return NextResponse.json({ error: 'Seller ID and rating are required' }, { status: 400 })
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
    }

    // Check if user has purchased and received from this seller
    const { data: deliveredOrders, error: orderError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('buyer_id', user.id)
      .eq('seller_id', seller_id)
      .eq('status', 'delivered')
      .order('created_at', { ascending: false })
      .limit(1)

    if (orderError) {
      console.error('Error checking order:', orderError)
      return NextResponse.json({ error: 'Failed to verify purchase' }, { status: 500 })
    }

    if (!deliveredOrders || deliveredOrders.length === 0) {
      return NextResponse.json({ 
        error: 'You can only review sellers you have purchased from and received an order' 
      }, { status: 403 })
    }

    // Check if user already reviewed this seller
    const { data: existingReview } = await supabase
      .from('seller_reviews')
      .select('id')
      .eq('seller_id', seller_id)
      .eq('user_id', user.id)
      .single()

    if (existingReview) {
      return NextResponse.json({ error: 'You have already reviewed this product' }, { status: 400 })
    }

    const reviewData = {
      seller_id,
      user_id: user.id,
      rating,
      comment: review || null,
      title: title || null,
      images: Array.isArray(images) ? images : [],
      order_id: deliveredOrders[0]?.id || null,
      created_at: new Date().toISOString()
    }

    const { data: newReview, error } = await supabase
      .from('seller_reviews')
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
