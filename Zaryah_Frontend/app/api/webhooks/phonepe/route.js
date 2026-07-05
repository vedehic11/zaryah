// PhonePe Webhook Handler - Handles payment events asynchronously
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import crypto from 'crypto'
import { sendSellerOrderNotificationIfNeeded } from '@/lib/order-notifications'

const SELLER_COMMISSION_RATE = 2.5

export async function POST(request) {
  try {
    const body = await request.text()

    // Verify HMAC signature from PhonePe
    const webhookSecret = process.env.PHONEPE_WEBHOOK_SECRET
    const xVerifyHeader = request.headers.get('x-verify')

    if (webhookSecret && xVerifyHeader) {
      const [receivedHash] = xVerifyHeader.split('###')
      const expectedHash = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex')

      if (receivedHash !== expectedHash) {
        console.error('Invalid PhonePe webhook HMAC signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
      }
    }

    const event = JSON.parse(body)
    const eventType = event.event || event.type || ''
    console.log('PhonePe webhook received, event:', eventType, 'code:', event.code)

    // PhonePe Standard Checkout webhook events:
    //   checkout.order.completed  → payment successful
    //   checkout.order.failed     → payment failed
    // Also handle legacy codes: PAYMENT_SUCCESS, PAYMENT_ERROR, PAYMENT_DECLINED
    const paymentData = event.data || event.payload?.payment?.entity || {}
    const merchantTransactionId = paymentData.merchantTransactionId
      || paymentData.merchant_transaction_id
      || event.data?.merchantTransactionId
    const transactionId = paymentData.transactionId || paymentData.transaction_id

    const isSuccess = eventType === 'checkout.order.completed'
      || eventType === 'payment.page.order.completed'
      || eventType === 'pg.order.completed'
      || event.code === 'PAYMENT_SUCCESS'
      || paymentData.state === 'COMPLETED'

    const isFailed = eventType === 'checkout.order.failed'
      || eventType === 'payment.page.order.failed'
      || eventType === 'pg.order.failed'
      || event.code === 'PAYMENT_ERROR'
      || event.code === 'PAYMENT_DECLINED'
      || event.code === 'TIMED_OUT'

    const isRefundCompleted = eventType === 'pg.refund.completed'
    const isRefundFailed = eventType === 'pg.refund.failed'

    if (!merchantTransactionId) {
      console.error('No merchantTransactionId in webhook payload:', JSON.stringify(event).substring(0, 500))
      return NextResponse.json({ received: true })
    }

    // Find order by payment_id (merchantTransactionId stored at initiation)
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .eq('payment_id', merchantTransactionId)
      .eq('payment_method', 'online')

    if (!orders || orders.length === 0) {
      console.error('No order found for merchantTransactionId:', merchantTransactionId)
      return NextResponse.json({ received: true })
    }

    for (const order of orders) {
      if (isSuccess) {
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
            payment_id: merchantTransactionId
          })
          .eq('id', order.id)

        console.log(`✅ Webhook: Order ${order.id} marked as paid`)

        const notificationResult = await sendSellerOrderNotificationIfNeeded({
          order: { ...order, payment_status: 'paid' },
          totalAmount: parseFloat(order.total_amount || 0),
          items: []
        })

        if (notificationResult.sent) {
          console.log(`✅ Webhook: Seller email sent for order ${order.id}`)
        } else {
          console.log(`ℹ️ Webhook: Seller email not sent for order ${order.id}:`, notificationResult.reason)
        }
      } else if (isFailed) {
        // Payment failed
        console.log(`❌ Webhook: Payment failed for order ${order.id}, event: ${eventType}, code: ${event.code}`)
        await supabase
          .from('orders')
          .update({ payment_status: 'failed' })
          .eq('id', order.id)

      } else if (isRefundCompleted) {
        // Refund was processed successfully by PhonePe
        console.log(`💰 Webhook: Refund completed for order ${order.id}`)
        const currentNotes = order.notes || ''
        await supabase
          .from('orders')
          .update({
            payment_status: 'refunded',
            notes: currentNotes + `\nRefund confirmed by PhonePe webhook at ${new Date().toISOString()}`
          })
          .eq('id', order.id)

      } else if (isRefundFailed) {
        // Refund failed — admin needs to process manually
        console.log(`❌ Webhook: Refund FAILED for order ${order.id}`)
        const currentNotes = order.notes || ''
        await supabase
          .from('orders')
          .update({
            payment_status: 'refund_pending',
            notes: currentNotes + `\nPhonePe refund failed (webhook). Manual refund required.`
          })
          .eq('id', order.id)

      } else {
        console.log(`⚠️ Webhook: Unhandled event for order ${order.id}, event: ${eventType}, code: ${event.code}`)
      }
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('PhonePe webhook error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
