// DEPRECATED: This webhook is legacy and should not be used for new integrations
// Use /api/webhooks/delivery-updates instead, which handles Shiprocket webhooks properly
// This endpoint is kept for backwards compatibility only
//
// Next.js API route for order status webhook (from Shiprocket or manual update)
// This moves seller funds from pending_balance to available_balance on delivery
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// POST /api/webhooks/order-status - Handle order status updates
export async function POST(request) {
  try {
    // Log deprecation warning
    console.warn('⚠️ DEPRECATED WEBHOOK CALLED: /api/webhooks/order-status')
    console.warn('⚠️ Please use /api/webhooks/delivery-updates instead')
    
    // Verify webhook authenticity
    const webhookSecret = process.env.WEBHOOK_SECRET
    const signature = request.headers.get('x-webhook-signature')

    if (!webhookSecret) {
      console.error('WEBHOOK_SECRET is not configured')
      return NextResponse.json({ error: 'Webhook is not configured' }, { status: 503 })
    }
    
    if (!signature || signature !== webhookSecret) {
      console.warn('Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const body = await request.json()
    const { order_id, status, tracking_data } = body

    // Validate input
    if (!order_id || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    console.log(`📦 Order status update: ${order_id} -> ${status}`)

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, seller_id, seller_amount, status as current_status, wallet_credited')
      .eq('id', order_id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Update order status
    await supabase
      .from('orders')
      .update({ 
        status: status,
        tracking_data: tracking_data || null
      })
      .eq('id', order_id)

    // Handle different status transitions
    if (status === 'delivered' && !order.wallet_credited) {
      // Move funds from pending to available
      try {
        const { data: result, error: walletError } = await supabase
          .rpc('move_pending_to_available', {
            p_seller_id: order.seller_id,
            p_order_id: order.id,
            p_amount: order.seller_amount
          })

        if (walletError) {
          console.error('Wallet update error:', walletError)
          throw walletError
        }

        // Mark order as wallet credited
        await supabase
          .from('orders')
          .update({ wallet_credited: true })
          .eq('id', order_id)

        console.log(`✅ Moved ₹${order.seller_amount} from pending to available for seller ${order.seller_id}`)

      } catch (walletError) {
        console.error('Failed to credit wallet:', walletError)
        // Don't fail the webhook - log for manual processing
        return NextResponse.json({
          success: false,
          error: 'Wallet credit failed',
          details: walletError.message,
          action: 'manual_review_required'
        }, { status: 500 })
      }
    } else if (status === 'cancelled' || status === 'rto') {
      // Reverse the pending balance and refund buyer
      try {
        // Deduct from pending balance
        const { data: wallet, error: walletFetchError } = await supabase
          .from('wallets')
          .select('pending_balance')
          .eq('seller_id', order.seller_id)
          .maybeSingle()

        if (walletFetchError || !wallet) {
          throw new Error('Seller wallet not found')
        }

        const currentPending = parseFloat(wallet.pending_balance || 0)
        const orderAmount = parseFloat(order.seller_amount || 0)
        const nextPending = Math.max(0, currentPending - orderAmount)

        await supabase
          .from('wallets')
          .update({
            pending_balance: nextPending
          })
          .eq('seller_id', order.seller_id)

        // Create reversal transaction
        await supabase
          .from('transactions')
          .insert({
            seller_id: order.seller_id,
            order_id: order.id,
            amount: -order.seller_amount,
            type: 'reversal_rto',
            description: `Order ${status.toUpperCase()} - funds reversed`,
            status: 'completed'
          })

        // Reverse admin commission
        await supabase
          .from('admin_earnings')
          .update({
            status: 'reversed',
            reversed_at: new Date().toISOString()
          })
          .eq('order_id', order_id)

        console.log(`↩️ Reversed ₹${order.seller_amount} for ${status} order ${order_id}`)

      } catch (reversalError) {
        console.error('Failed to reverse funds:', reversalError)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Order status updated successfully',
      order_id: order_id,
      new_status: status
    })

  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 })
  }
}

// GET /api/webhooks/order-status - Test endpoint (for development)
export async function GET(request) {
  return NextResponse.json({
    message: 'Order status webhook endpoint',
    usage: 'POST with { order_id, status, tracking_data }',
    statuses: ['pending', 'confirmed', 'dispatched', 'delivered', 'cancelled', 'rto']
  })
}
