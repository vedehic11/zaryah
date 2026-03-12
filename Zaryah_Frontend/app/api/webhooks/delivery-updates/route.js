// Shiprocket webhook endpoint
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyWebhookSignature, mapShiprocketStatus } from '@/lib/shiprocket'
import { applyShiprocketOrderUpdate } from '@/lib/shiprocket-sync'

export async function POST(request) {
  try {
    console.log('=== Shiprocket Webhook Received ===')
    
    // Get raw body for signature verification
    const rawBody = await request.text()
    const signature = request.headers.get('x-shiprocket-signature')
    const apiKey = request.headers.get('x-api-key')
    
    console.log('Signature present:', !!signature)
    console.log('API Key present:', !!apiKey)
    console.log('Raw body length:', rawBody.length)
    
    // Handle Shiprocket test/ping requests (uses x-api-key header with token)
    if (apiKey) {
      const expectedToken = process.env.SHIPROCKET_WEBHOOK_SECRET
      if (apiKey === expectedToken) {
        console.log('✅ Shiprocket test request authenticated via x-api-key')
        return NextResponse.json({ 
          success: true,
          message: 'Webhook endpoint is active and ready to receive events'
        }, { status: 200 })
      } else {
        console.error('Invalid x-api-key token')
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
      }
    }
    
    // Handle empty body test requests (legacy format)
    if (!rawBody || rawBody.trim() === '' || rawBody === '{}') {
      console.log('✅ Shiprocket test/ping request - responding OK')
      return NextResponse.json({ 
        success: true,
        message: 'Webhook endpoint is active and ready to receive events'
      }, { status: 200 })
    }
    
    // SECURITY: Require signature for actual webhook events
    if (!signature) {
      console.error('Missing webhook signature for non-empty payload')
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }
    
    // Verify webhook signature
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error('Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    
    const payload = JSON.parse(rawBody)
    console.log('Webhook payload:', JSON.stringify(payload, null, 2))
    
    // Extract shipment details from payload with fallbacks for Shiprocket format variations
    const orderId = payload.order_id || payload.orderId || payload.channel_order_id || payload.channelOrderId || payload.reference_id
    const shipmentId = payload.shipment_id || payload.shipmentId || payload.shipment?.id
    const awbCode = payload.awb_code || payload.awbCode || payload.awb || payload.shipment_awb
    const courierName = payload.courier_name || payload.courierName || payload.courier
    const shipmentTrack = payload.shipment_track || payload.shipmentTrack || payload.tracking_data || payload.scans || []
    const fallbackTrackStatus = Array.isArray(shipmentTrack) && shipmentTrack.length > 0
      ? (shipmentTrack[0]?.current_status || shipmentTrack[0]?.status || shipmentTrack[0]?.activity)
      : null
    const currentStatus = payload.current_status || payload.currentStatus || payload.shipment_status || payload.status || payload.shipment_status_id || fallbackTrackStatus
    const deliveredDate = payload.delivered_date || payload.deliveredDate || payload.delivery_date || payload.deliveryDate

    if (!orderId && !shipmentId && !awbCode) {
      console.error('Missing order_id, shipment_id, and awb_code in webhook')
      return NextResponse.json({ error: 'Missing order identifiers' }, { status: 400 })
    }

    const lookupCandidates = []

    if (orderId) {
      lookupCandidates.push({ field: 'id', value: orderId })
      if (typeof orderId !== 'string') {
        lookupCandidates.push({ field: 'id', value: String(orderId) })
      }
    }

    if (shipmentId) {
      lookupCandidates.push({ field: 'shipment_id', value: shipmentId })
      if (typeof shipmentId !== 'string') {
        lookupCandidates.push({ field: 'shipment_id', value: String(shipmentId) })
      }
    }

    if (awbCode) {
      lookupCandidates.push({ field: 'awb_code', value: awbCode })
    }

    let order = null
    let fetchError = null

    for (const candidate of lookupCandidates) {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq(candidate.field, candidate.value)
        .maybeSingle()

      if (error) {
        fetchError = error
        continue
      }

      if (data) {
        order = data
        break
      }
    }
    
    if (fetchError || !order) {
      console.error('Order not found:', { orderId, shipmentId, awbCode, fetchError })
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    
    console.log('Order found:', order.id)
    
    const statusMapping = mapShiprocketStatus(currentStatus)
    console.log('Status mapping:', {
      shiprocketStatus: currentStatus,
      newStatus: statusMapping.status,
      isRTO: statusMapping.isRTO,
      requiresRefund: statusMapping.requiresRefund
    })

    await applyShiprocketOrderUpdate(order, {
      currentStatus,
      awbCode,
      courierName,
      trackingUrl: awbCode ? `https://shiprocket.co/tracking/${awbCode}` : order.tracking_url,
      deliveredDate
    }, {
      source: 'webhook'
    })

    console.log('Order updated successfully')
    
    return NextResponse.json({ success: true, message: 'Webhook processed' })
  } catch (error) {
    console.error('=== Webhook Processing Error ===')
    console.error('Error:', error.message)
    console.error('Stack:', error.stack)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Handle GET requests (for webhook verification)
export async function GET(request) {
  return NextResponse.json({ 
    message: 'Shiprocket webhook endpoint', 
    status: 'active' 
  })
}
