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

    const { orderId, razorpayPaymentId, reason } = await request.json()

    if (!orderId || !razorpayPaymentId) {
      return NextResponse.json({ error: 'Order ID and Payment ID required' }, { status: 400 })
    }

    console.log(`Admin initiating refund for order ${orderId}, payment ${razorpayPaymentId}`)

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Initiate refund via Razorpay
    let refund
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

    // Update order status
    await supabase
      .from('orders')
      .update({
        payment_status: 'refunded',
        status: 'cancelled',
        notes: `Refunded: ${refund.id} - ${reason || 'Admin initiated'}`
      })
      .eq('id', orderId)

    // Reverse seller wallet credit if it was already credited
    if (order.payment_status === 'paid') {
      const sellerAmount = order.seller_amount || (order.total_amount * 0.95)
      
      const { data: wallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('seller_id', order.seller_id)
        .maybeSingle()

      if (wallet) {
        await supabase
          .from('wallets')
          .update({
            pending_balance: Math.max(0, parseFloat(wallet.pending_balance) - sellerAmount),
            total_earned: Math.max(0, parseFloat(wallet.total_earned) - sellerAmount)
          })
          .eq('seller_id', order.seller_id)

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
              payment_id: razorpayPaymentId,
              reason: reason || 'Admin initiated refund'
            }
          })
      }
    }

    console.log(`✅ Order ${orderId} refunded successfully`)

    return NextResponse.json({
      success: true,
      message: 'Refund initiated successfully',
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
