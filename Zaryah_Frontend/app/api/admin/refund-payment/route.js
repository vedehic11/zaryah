// Admin endpoint to refund payments via PhonePe
import { NextResponse } from 'next/server'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import crypto from 'crypto'

const PHONEPE_API_BASE = process.env.PHONEPE_ENV === 'PRODUCTION'
  ? 'https://api.phonepe.com/apis/hermes'
  : 'https://api-preprod.phonepe.com/apis/pg-sandbox'

export async function POST(request) {
  try {
    const session = await requireAuth(request)
    const user = await getUserBySupabaseAuthId(session.user.id)

    if (!user || user.user_type !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { orderId, reason, manualRefund = false, manualReference } = await request.json()

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
    }

    console.log(`Admin initiating ${manualRefund ? 'manual ' : ''}refund for order ${orderId}`)

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Initiate refund via PhonePe or mark manual
    let refund
    if (manualRefund) {
      refund = {
        id: `manual_${Date.now()}`,
        amount: Math.round(order.total_amount * 100),
        status: 'processed'
      }
    } else {
      // PhonePe Refund API requires the original merchantTransactionId
      const merchantTransactionId = order.payment_id
      if (!merchantTransactionId) {
        return NextResponse.json({ error: 'No payment transaction ID found for this order' }, { status: 400 })
      }

      const refundTransactionId = `REFUND_${Date.now()}_${orderId.substring(0, 8)}`
      const merchantId = process.env.PHONEPE_MERCHANT_ID
      const saltKey = process.env.PHONEPE_SALT_KEY
      const saltIndex = process.env.PHONEPE_SALT_INDEX || '1'

      const refundPayload = {
        merchantId: merchantId,
        merchantUserId: `MUID_${user.id.substring(0, 20)}`,
        originalTransactionId: merchantTransactionId,
        merchantTransactionId: refundTransactionId,
        amount: Math.round(order.total_amount * 100), // Full refund in paise
        callbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/phonepe`
      }

      const base64Payload = Buffer.from(JSON.stringify(refundPayload)).toString('base64')
      const refundEndpoint = '/pg/v1/refund'
      const checksumString = base64Payload + refundEndpoint + saltKey
      const checksum = crypto.createHash('sha256').update(checksumString).digest('hex') + '###' + saltIndex

      try {
        const refundResponse = await fetch(`${PHONEPE_API_BASE}${refundEndpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-VERIFY': checksum,
            'accept': 'application/json'
          },
          body: JSON.stringify({ request: base64Payload })
        })

        const refundResult = await refundResponse.json()
        console.log('PhonePe refund response:', JSON.stringify(refundResult, null, 2))

        if (!refundResult.success) {
          console.error('PhonePe refund API failed:', refundResult.message)

          // Mark order as refund_pending so admin knows to process manually
          await supabase
            .from('orders')
            .update({
              payment_status: 'refund_pending',
              notes: `PhonePe refund failed (${refundResult.message || 'Unknown error'}). Manual refund required. Original TxnID: ${merchantTransactionId}`
            })
            .eq('id', orderId)

          return NextResponse.json({
            success: false,
            error: `PhonePe refund failed: ${refundResult.message || 'Unknown error'}`,
            action_required: 'Order marked as refund_pending. Please refund manually via PhonePe dashboard and then use the manual refund option.',
            original_transaction_id: merchantTransactionId,
            amount: order.total_amount
          }, { status: 400 })
        }

        refund = {
          id: refundTransactionId,
          amount: Math.round(order.total_amount * 100),
          status: 'processed'
        }
        console.log('✅ PhonePe refund initiated:', refundTransactionId)
      } catch (phonepeError) {
        console.error('PhonePe refund error:', phonepeError)

        // Network/timeout error — mark as pending for manual processing
        await supabase
          .from('orders')
          .update({
            payment_status: 'refund_pending',
            notes: `PhonePe refund network error: ${phonepeError.message}. Manual refund required. Original TxnID: ${merchantTransactionId}`
          })
          .eq('id', orderId)

        return NextResponse.json({
          success: false,
          error: `PhonePe refund request failed: ${phonepeError.message}`,
          action_required: 'Order marked as refund_pending. Please refund manually via PhonePe dashboard.',
          original_transaction_id: merchantTransactionId,
          amount: order.total_amount
        }, { status: 400 })
      }
    }

    const manualReferenceText = manualReference ? ` (Ref: ${manualReference})` : ''
    const refundNote = manualRefund
      ? `Manual refund recorded${manualReferenceText} - ${reason || 'Admin marked as refunded'}`
      : `Refunded: ${refund.id} - ${reason || 'Admin initiated'}`
    const notesAccumulator = order.notes ? `${order.notes}\n${refundNote}` : refundNote

    // Update order status
    await supabase
      .from('orders')
      .update({
        payment_status: 'refunded',
        status: 'cancelled',
        notes: notesAccumulator
      })
      .eq('id', orderId)

    // Reverse seller wallet credit if it was already credited
    if (order.payment_status === 'paid') {
      const sellerAmount = parseFloat(order.seller_amount || 0)

      if (sellerAmount <= 0) {
        console.warn(`Skipping wallet reversal for order ${orderId}: invalid seller_amount`, order.seller_amount)
      }
      
      const { data: wallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('seller_id', order.seller_id)
        .maybeSingle()

      if (wallet && sellerAmount > 0) {
        const currentPending = parseFloat(wallet.pending_balance || 0)
        const currentAvailable = parseFloat(wallet.available_balance || 0)
        const currentTotalEarned = parseFloat(wallet.total_earned || 0)

        const nextPending = order.wallet_credited ? currentPending : Math.max(0, currentPending - sellerAmount)
        const nextAvailable = order.wallet_credited ? Math.max(0, currentAvailable - sellerAmount) : currentAvailable

        await supabase
          .from('wallets')
          .update({
            pending_balance: nextPending,
            available_balance: nextAvailable,
            total_earned: Math.max(0, currentTotalEarned - sellerAmount)
          })
          .eq('seller_id', order.seller_id)

        if (order.wallet_credited) {
          await supabase
            .from('orders')
            .update({ wallet_credited: false })
            .eq('id', orderId)
        }

        // Create debit transaction
        await supabase
          .from('transactions')
          .insert({
            seller_id: order.seller_id,
            type: 'debit_refund',
            amount: sellerAmount,
            status: 'completed',
            description: `Refund reversal for order #${orderId}`,
            order_id: orderId,
            metadata: {
              refund_id: refund.id,
              payment_id: order.payment_id || null,
              manual_refund: manualRefund,
              manual_reference: manualReference || null,
              reason: reason || 'Admin initiated refund'
            }
          })
      }
    }

    console.log(`✅ Order ${orderId} ${manualRefund ? 'marked as manually refunded' : 'refunded successfully'}`)

    return NextResponse.json({
      success: true,
      message: manualRefund ? 'Manual refund recorded successfully' : 'Refund initiated successfully',
      refund_id: refund.id,
      amount: order.total_amount,
      order: {
        id: orderId,
        payment_status: 'refunded',
        status: 'cancelled'
      }
    })

  } catch (error) {
    console.error('Refund error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to process refund' 
    }, { status: 500 })
  }
}
