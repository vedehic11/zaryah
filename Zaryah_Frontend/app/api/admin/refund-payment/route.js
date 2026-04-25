// Admin endpoint to refund payments
import { NextResponse } from 'next/server'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import Razorpay from 'razorpay'

const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

export async function POST(request) {
  try {
    const session = await requireAuth(request)
    const user = await getUserBySupabaseAuthId(session.user.id)

    if (!user || user.user_type !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { orderId, razorpayPaymentId, reason, manualRefund = false, manualReference } = await request.json()

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
    }

    if (!manualRefund && !razorpayPaymentId) {
      return NextResponse.json({ error: 'Razorpay Payment ID required' }, { status: 400 })
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

    // Initiate refund via Razorpay (or mark manual refund)
    let refund
    if (manualRefund) {
      refund = {
        id: `manual_${Date.now()}`,
        amount: Math.round(order.total_amount * 100),
        status: 'processed'
      }
    } else {
      try {
        refund = await razorpay.payments.refund(razorpayPaymentId, {
          amount: Math.round(order.total_amount * 100), // Full refund in paise
          notes: {
            order_id: orderId,
            reason: reason || 'Admin initiated refund'
          }
        })
        console.log('✅ Razorpay refund initiated:', refund.id)
      } catch (rzpError) {
        console.error('Razorpay refund error:', rzpError)
        return NextResponse.json({ 
          error: `Razorpay refund failed: ${rzpError.error?.description || rzpError.message}` 
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
              payment_id: razorpayPaymentId || order.razorpay_payment_id || null,
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
