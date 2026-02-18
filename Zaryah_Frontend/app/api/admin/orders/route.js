// Admin endpoint to get orders with payment issues
import { NextResponse } from 'next/server'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function GET(request) {
  try {
    const session = await requireAuth(request)
    const user = await getUserBySupabaseAuthId(session.user.id)

    if (!user || user.user_type !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const paymentStatus = searchParams.get('payment_status') || 'all'

    let query = supabase
      .from('orders')
      .select('*')
      .eq('payment_method', 'online')
      .order('created_at', { ascending: false })

    if (paymentStatus !== 'all') {
      query = query.eq('payment_status', paymentStatus)
    }

    const { data: orders, error } = await query

    if (error) {
      console.error('Error fetching orders:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      orders: orders || [],
      count: orders?.length || 0
    })

  } catch (error) {
    console.error('Admin orders fetch error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch orders' 
    }, { status: 500 })
  }
}
