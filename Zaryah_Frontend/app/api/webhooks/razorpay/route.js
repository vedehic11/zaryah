// Razorpay Webhook Handler - Handles payment events even if user closes browser
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import crypto from 'crypto'

// Commission: 2.5% from seller + Platform fee (₹10 or ₹20) from buyer
const SELLER_COMMISSION_RATE = 2.5

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

        // Skip if wallet already credited (payment/verify route handles wallet crediting)
        if (order.wallet_credited) {
          console.log(`Order ${order.id} wallet already credited, skipping`)
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
        console.log('ℹ️  Note: Wallet crediting handled by payment/verify route')
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
