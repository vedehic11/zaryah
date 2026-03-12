import { NextResponse } from 'next/server'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getShipmentDetails, getShipmentTracking, mapShiprocketStatus } from '@/lib/shiprocket'

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

    let liveStatus = null
    let liveAwbCode = order.awb_code || null
    let liveCourierName = order.courier_name || null
    let deliveredDate = null

    if (order.awb_code) {
      try {
        const trackingData = await getShipmentTracking(order.awb_code)
        const tracking = trackingData?.tracking_data || trackingData || {}

        liveStatus = tracking.shipment_status || tracking.current_status || tracking.status || liveStatus
        deliveredDate = tracking.delivered_date || tracking.delivery_date || null
      } catch (trackingError) {
        console.warn('Tracking sync fallback to shipment_id:', trackingError.message)
      }
    }

    if ((!liveStatus || !liveAwbCode) && order.shipment_id) {
      const shipment = await getShipmentDetails(order.shipment_id)
      liveStatus = liveStatus || shipment?.status || null
      liveAwbCode = liveAwbCode || shipment?.awbCode || null
      liveCourierName = liveCourierName || shipment?.courierName || null
    }

    if (!liveStatus && !liveAwbCode && !liveCourierName) {
      return NextResponse.json({
        success: true,
        message: 'No live shipment updates available',
        order
      })
    }

    const mapped = mapShiprocketStatus(liveStatus)
    const updates = {}

    if (liveStatus !== null && liveStatus !== undefined) {
      updates.shipment_status = String(liveStatus)
    }

    if (mapped.status) {
      updates.status = mapped.status
    }

    if (liveAwbCode) {
      updates.awb_code = liveAwbCode
      updates.tracking_url = `https://shiprocket.co/tracking/${liveAwbCode}`
    }

    if (liveCourierName) {
      updates.courier_name = liveCourierName
    }

    if (deliveredDate && mapped.status === 'delivered') {
      updates.updated_at = new Date(deliveredDate).toISOString()
    }

    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Order shipment status synced successfully',
      updates,
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
