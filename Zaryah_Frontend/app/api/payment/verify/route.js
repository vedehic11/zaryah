// POST /api/payment/verify - Verify Razorpay payment signature and credit seller wallets
import { NextResponse } from 'next/server'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import crypto from 'crypto'

// Commission rate (5%)
const COMMISSION_RATE = 5.0

export async function POST(request) {
  try {
    const session = await requireAuth(request)
    const user = await getUserBySupabaseAuthId(session.user.id)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = body

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment verification data' }, { status: 400 })
    }

    console.log('Verifying payment:', { razorpay_order_id, razorpay_payment_id, order_id })

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    const isValid = expectedSignature === razorpay_signature

    if (!isValid) {
      console.error('Invalid payment signature')
      return NextResponse.json({ 
        success: false,
        error: 'Invalid payment signature' 
      }, { status: 400 })
    }

    console.log('✅ Payment signature verified')

    // Payment verified! Now process wallet credits
    if (order_id) {
      // Update order payment status
      await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          razorpay_payment_id: razorpay_payment_id
        })
        .eq('id', order_id)

      console.log(`Order ${order_id} marked as paid`)

      // Get order details
      const { data: order } = await supabase
        .from('orders')
        .select('seller_id, seller_amount, commission_amount, total_amount')
        .eq('id', order_id)
        .single()

      if (order && order.seller_id) {
        // Calculate amounts if not already set
        const sellerAmount = order.seller_amount || (order.total_amount * 0.95)
        const commissionAmount = order.commission_amount || (order.total_amount * 0.05)

        // Credit seller wallet (PENDING balance until delivery)
        const { data: walletResult, error: walletError } = await supabase.rpc('credit_seller_wallet_pending', {
          p_seller_id: order.seller_id,
          p_order_id: order_id,
          p_amount: sellerAmount,
          p_description: `Payment received for order - pending delivery confirmation`
        })

        if (walletError) {
          console.error('Wallet credit error:', walletError)
        } else {
          console.log(`✅ Wallet credited (pending) for seller ${order.seller_id}: ₹${sellerAmount}`)
        }

        // Record admin commission
        const { error: commissionError } = await supabase
          .from('admin_earnings')
          .insert({
            order_id: order_id,
            seller_id: order.seller_id,
            order_amount: order.total_amount,
            commission_rate: COMMISSION_RATE,
            commission_amount: commissionAmount,
            seller_amount: sellerAmount,
            status: 'earned'
          })

        if (commissionError) {
          console.error('Commission record error:', commissionError)
        } else {
          console.log(`💰 Admin commission recorded: ₹${commissionAmount}`)
        }
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Payment verified successfully',
      payment_id: razorpay_payment_id
    })

  } catch (error) {
    console.error('=== Payment Verification Error ===')
    console.error('Error:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ 
      error: 'Payment verification failed',
      details: error.message
    }, { status: 500 })
  }
}
