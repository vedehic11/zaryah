// Razorpay Webhook Handler - Handles payment events even if user closes browser
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import crypto from 'crypto'

const COMMISSION_RATE = 5.0

export async function POST(request) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-razorpay-signature')
    
    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex')
    
    if (signature !== expectedSignature) {
      console.error('Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const event = JSON.parse(body)
    console.log('Razorpay webhook event:', event.event)

    // Handle payment.authorized or payment.captured events
    if (event.event === 'payment.authorized' || event.event === 'payment.captured') {
      const payment = event.payload.payment.entity
      const razorpayOrderId = payment.order_id
      const razorpayPaymentId = payment.id

      console.log(`Processing payment: ${razorpayPaymentId} for order: ${razorpayOrderId}`)

      // Find order by razorpay_order_id (stored when creating payment order)
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('payment_id', razorpayOrderId)
        .eq('payment_method', 'online')

      if (!orders || orders.length === 0) {
        console.error('No order found for razorpay order_id:', razorpayOrderId)
        return NextResponse.json({ received: true })
      }

      for (const order of orders) {
        // Skip if already paid
        if (order.payment_status === 'paid') {
          console.log(`Order ${order.id} already marked as paid`)
          continue
        }

        // Update order payment status
        await supabase
          .from('orders')
          .update({
            payment_status: 'paid',
            razorpay_payment_id: razorpayPaymentId
          })
          .eq('id', order.id)

        console.log(`✅ Webhook: Order ${order.id} marked as paid`)

        // Calculate seller amount and commission
        const sellerAmount = order.seller_amount || (order.total_amount * 0.95)
        const commissionAmount = order.commission_amount || (order.total_amount * 0.05)

        // Get or create seller wallet
        let { data: wallet } = await supabase
          .from('wallets')
          .select('*')
          .eq('user_id', order.seller_id)
          .single()

        if (!wallet) {
          const { data: newWallet } = await supabase
            .from('wallets')
            .insert({
              user_id: order.seller_id,
              pending_balance: sellerAmount,
              available_balance: 0,
              total_earned: sellerAmount
            })
            .select()
            .single()
          wallet = newWallet
        } else {
          await supabase
            .from('wallets')
            .update({
              pending_balance: parseFloat(wallet.pending_balance || 0) + sellerAmount,
              total_earned: parseFloat(wallet.total_earned || 0) + sellerAmount
            })
            .eq('user_id', order.seller_id)
        }

        // Create transaction record
        await supabase
          .from('transactions')
          .insert({
            wallet_id: wallet.id,
            type: 'credit',
            amount: sellerAmount,
            status: 'pending',
            description: `Payment for order #${order.id}`,
            order_id: order.id,
            payment_id: razorpayPaymentId
          })

        console.log(`✅ Webhook: Wallet credited for seller ${order.seller_id}`)
      }
    }

    // Handle payment.failed events
    if (event.event === 'payment.failed') {
      const payment = event.payload.payment.entity
      const razorpayOrderId = payment.order_id

      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .eq('payment_id', razorpayOrderId)

      if (orders && orders.length > 0) {
        for (const order of orders) {
          await supabase
            .from('orders')
            .update({ payment_status: 'failed' })
            .eq('id', order.id)
          
          console.log(`❌ Webhook: Order ${order.id} marked as failed`)
        }
      }
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 })
  }
}
