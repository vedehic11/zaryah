// Shiprocket webhook endpoint
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyWebhookSignature, mapShiprocketStatus } from '@/lib/shiprocket'

export async function POST(request) {
  try {
    console.log('=== Shiprocket Webhook Received ===')
    
    // Get raw body for signature verification
    const rawBody = await request.text()
    const signature = request.headers.get('x-shiprocket-signature')
    
    console.log('Signature present:', !!signature)
    console.log('Raw body length:', rawBody.length)
    
    // Handle Shiprocket test/ping requests (empty body without signature)
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
    
    // Extract shipment details from payload
    const {
      order_id,
      shipment_id,
      awb_code,
      courier_name,
      current_status,
      delivered_date,
      shipment_track
    } = payload
    
    if (!order_id && !shipment_id) {
      console.error('Missing order_id or shipment_id in webhook')
      return NextResponse.json({ error: 'Missing order or shipment ID' }, { status: 400 })
    }
    
    // Find order by order_id or shipment_id
    let query = supabase.from('orders').select('*')
    
    if (order_id) {
      query = query.eq('id', order_id)
    } else {
      query = query.eq('shipment_id', shipment_id)
    }
    
    const { data: order, error: fetchError } = await query.single()
    
    if (fetchError || !order) {
      console.error('Order not found:', order_id || shipment_id)
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    
    console.log('Order found:', order.id)
    
    // Map Shiprocket status to internal order status
    const newStatus = mapShiprocketStatus(current_status)
    
    const updates = {
      shipment_status: current_status
    }
    
    // Update order status if mapping exists
    if (newStatus) {
      updates.status = newStatus
      console.log(`Updating order status from ${order.status} to ${newStatus}`)
    }
    
    // Update AWB and courier if provided
    if (awb_code && !order.awb_code) {
      updates.awb_code = awb_code
      updates.tracking_url = `https://shiprocket.co/tracking/${awb_code}`
    }
    
    if (courier_name && !order.courier_name) {
      updates.courier_name = courier_name
    }
    
    // Update delivery date if delivered
    if (delivered_date && newStatus === 'delivered') {
      updates.updated_at = new Date(delivered_date).toISOString()
    }
    
    // Update order
    const { error: updateError } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', order.id)
    
    if (updateError) {
      console.error('Failed to update order:', updateError)
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
    }
    
    console.log('Order updated successfully')
    
    // Handle delivery - release seller funds and update payment status
    if (newStatus === 'delivered') {
      console.log('Processing order delivery from webhook...')
      
      try {
        // Release seller wallet funds from pending to available
        if (order.payment_status === 'paid' && order.seller_id) {
          console.log(`Releasing pending funds for seller ${order.seller_id}...`)
          
          const { error: walletError } = await supabase.rpc('release_seller_wallet_funds', {
            p_order_id: order.id
          })
          
          if (walletError) {
            console.error('Wallet fund release failed:', walletError)
            // Don't fail webhook processing, just log it
          } else {
            console.log('✅ Seller funds released to available balance')
          }
        }
        
        // Update COD payment status to paid on delivery
        if (order.payment_method === 'cod' && order.payment_status !== 'paid') {
          console.log('Updating COD order payment status to paid...')
          
          await supabase
            .from('orders')
            .update({ payment_status: 'paid' })
            .eq('id', order.id)
          
          console.log('✅ COD payment marked as paid')
        }
      } catch (deliveryError) {
        console.error('Error processing delivery in webhook:', deliveryError)
        // Don't fail webhook processing, just log the error
      }
    }
    
    // TODO: Send notification to buyer about delivery status update
    
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
