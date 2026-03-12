// GET /api/orders/[id]/tracking - Get real-time shipment tracking from Shiprocket
import { NextResponse } from 'next/server'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getShipmentTracking, mapShiprocketStatus } from '@/lib/shiprocket'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function getPassiveSyncStatus(mappedStatus) {
  return ['confirmed', 'dispatched'].includes(mappedStatus) ? mappedStatus : null
}

export async function GET(request, { params }) {
  try {
    const session = await requireAuth(request)
    const user = await getUserBySupabaseAuthId(session.user.id)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { id } = params

    // Get order with AWB code
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Check user has access to this order
    const isBuyer = user.user_type === 'Buyer' && order.buyer_id === user.id
    const isSeller = user.user_type === 'Seller' && order.seller_id === user.id
    const isAdmin = user.user_type === 'Admin'

    if (!isBuyer && !isSeller && !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check if shipment has been created
    if (!order.awb_code && !order.shipment_id) {
      return NextResponse.json({
        success: false,
        message: 'Shipment not yet created',
        order: {
          id: order.id,
          status: order.status,
          payment_status: order.payment_status
        }
      })
    }

    // Get tracking information from Shiprocket
    if (!order.awb_code) {
      return NextResponse.json({
        success: false,
        message: 'AWB code not assigned yet. Courier assignment pending.',
        order: {
          id: order.id,
          status: order.status,
          shipment_id: order.shipment_id
        }
      })
    }

    console.log(`Fetching tracking for AWB: ${order.awb_code}`)

    const trackingData = await getShipmentTracking(order.awb_code)

    console.log('Shiprocket tracking response:', JSON.stringify(trackingData, null, 2))

    // Extract tracking details
    const tracking = trackingData.tracking_data || trackingData
    
    // Get current status
    const currentStatus = tracking.shipment_status || tracking.current_status || order.shipment_status
    const statusMapping = mapShiprocketStatus(currentStatus)

    // Parse tracking history/scans
    const trackingHistory = tracking.shipment_track || tracking.scans || []

    // Build response
    const response = {
      success: true,
      order: {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        payment_status: order.payment_status
      },
      shipment: {
        awb_code: order.awb_code,
        courier_name: order.courier_name,
        shipment_id: order.shipment_id,
        current_status: currentStatus,
        mapped_status: statusMapping.status,
        display_status: order.status === 'cancelled' && statusMapping.status && statusMapping.status !== 'cancelled'
          ? statusMapping.status
          : order.status,
        is_rto: statusMapping.isRTO,
        requires_refund: statusMapping.requiresRefund,
        tracking_url: order.tracking_url || `https://shiprocket.co/tracking/${order.awb_code}`,
        delivered_date: tracking.delivered_date || null,
        expected_delivery_date: tracking.edd || tracking.expected_delivery_date || null
      },
      tracking_history: trackingHistory.map(scan => ({
        date: scan.date || scan.scan_datetime,
        status: scan.current_status || scan.activity,
        location: scan.location || scan.scan_location || 'Unknown',
        instructions: scan.instructions || scan.remark || ''
      })),
      raw_data: trackingData // For debugging
    }

    // If status has changed, optionally update database
    if (currentStatus && currentStatus !== order.shipment_status) {
      console.log(`Status changed from ${order.shipment_status} to ${currentStatus}, updating order...`)
      
      const updates = {
        shipment_status: currentStatus
      }
      
      const passiveStatus = getPassiveSyncStatus(statusMapping.status)
      if (passiveStatus && passiveStatus !== order.status) {
        updates.status = passiveStatus
        console.log(`Order status updating to: ${passiveStatus}`)
      }

      // Update in background (don't wait)
      supabase
        .from('orders')
        .update(updates)
        .eq('id', order.id)
        .then(() => console.log('✅ Order status updated from tracking fetch'))
        .catch(err => console.error('❌ Failed to update order status:', err))
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0'
      }
    })

  } catch (error) {
    console.error('Tracking fetch error:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ 
      success: false,
      error: 'Failed to fetch tracking details',
      message: error.message 
    }, { status: 500 })
  }
}
