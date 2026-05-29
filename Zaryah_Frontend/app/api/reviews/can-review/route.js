import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/reviews/can-review?sellerId=xxx - Check if user can review a seller
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
    const sellerId = searchParams.get('sellerId')

    if (!sellerId) {
      return NextResponse.json({ error: 'Seller ID is required' }, { status: 400 })
    }

    // Check if user has already reviewed this seller
    const { data: existingReview } = await supabase
      .from('seller_reviews')
      .select('id')
      .eq('seller_id', sellerId)
      .eq('user_id', user.id)
      .single()

    if (existingReview) {
      return NextResponse.json({ 
        canReview: false, 
        reason: 'Already reviewed' 
      })
    }

    // Check if user has purchased and received from this seller
    const { data: deliveredOrders, error: orderError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('buyer_id', user.id)
      .eq('seller_id', sellerId)
      .eq('status', 'delivered')
      .order('created_at', { ascending: false })
      .limit(1)

    if (orderError) {
      console.error('Error checking order:', orderError)
      return NextResponse.json({ error: 'Failed to verify purchase' }, { status: 500 })
    }

    if (!deliveredOrders || deliveredOrders.length === 0) {
      return NextResponse.json({ 
        canReview: false, 
        reason: 'Must purchase and receive from seller first' 
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
