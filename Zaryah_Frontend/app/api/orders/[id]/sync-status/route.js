import { NextResponse } from 'next/server'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { syncShiprocketOrderById } from '@/lib/shiprocket-sync'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request, { params }) {
  try {
    const session = await requireAuth(request)
    const user = await getUserBySupabaseAuthId(session.user.id)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    const { id } = await params

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const isBuyer = user.user_type === 'Buyer' && order.buyer_id === user.id
    const isSeller = user.user_type === 'Seller' && order.seller_id === user.id
    const isAdmin = user.user_type === 'Admin'

    if (!isBuyer && !isSeller && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const syncResult = await syncShiprocketOrderById(id, { source: 'manual' })

    const { data: updatedOrder, error: updatedOrderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    if (updatedOrderError) {
      return NextResponse.json({ error: updatedOrderError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Order shipment status synced successfully',
      sync: syncResult,
      order: updatedOrder
    })
  } catch (error) {
    console.error('Error syncing order shipment status:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
