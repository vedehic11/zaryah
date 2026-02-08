// Next.js API route for payment order creation with Razorpay + Wallet System
import { NextResponse } from 'next/server'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import Razorpay from 'razorpay'

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

// Commission rate (5%)
const COMMISSION_RATE = 5.0

// POST /api/payment/create-order - Create Razorpay order for checkout
export async function POST(request) {
  try {
    const session = await requireAuth(request)
    const user = await getUserBySupabaseAuthId(session.user.id)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { amount, currency = 'INR', orderId, notes = {} } = body

    // Validate amount
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    // SECURITY: Validate amount matches order total if orderId provided
    if (orderId) {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('id', orderId)
        .single()

      if (orderError || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }

      // Convert paise to rupees for comparison (frontend sends amount * 100)
      const amountInRupees = parseFloat(amount) / 100
      const orderTotal = parseFloat(order.total_amount)
      
      // Allow 1 rupee difference for rounding
      const amountDifference = Math.abs(amountInRupees - orderTotal)
      if (amountDifference > 1) {
        console.error('Payment amount mismatch:', {
          requestedPaise: amount,
          requestedRupees: amountInRupees,
          orderTotal: orderTotal,
          difference: amountDifference
        })
        return NextResponse.json({ 
          error: 'Payment amount mismatch',
          message: 'Payment amount does not match order total'
        }, { status: 400 })
      }
    }

    // Check if Razorpay is configured
    if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error('Razorpay credentials not configured')
      console.error('NEXT_PUBLIC_RAZORPAY_KEY_ID:', process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ? 'Set' : 'Missing')
      console.error('RAZORPAY_KEY_SECRET:', process.env.RAZORPAY_KEY_SECRET ? 'Set' : 'Missing')
      return NextResponse.json({ 
        error: 'Payment system not configured',
        message: 'Please contact support'
      }, { status: 500 })
    }

    console.log('Creating Razorpay order with amount (paise):', amount, 'for order:', orderId)

    // Amount is already in paise from frontend (total * 100)
    // Calculate commission (platform takes 5%) in rupees
    const orderAmountInRupees = parseFloat(amount) / 100
    const commissionAmount = Math.round((orderAmountInRupees * COMMISSION_RATE) / 100 * 100) / 100
    const sellerAmount = Math.round((orderAmountInRupees - commissionAmount) * 100) / 100

    // Create Razorpay order (amount already in paise)
    // Receipt must be max 40 chars - use short format
    const receipt = `ord_${Date.now()}_${user.id.substring(0, 8)}`
    const options = {
      amount: Math.round(amount), // Already in paise, just ensure it's integer
      currency,
      receipt: receipt,
      notes: {
        user_id: user.id,
        user_email: user.email,
        order_id: orderId,
        commission_amount: commissionAmount,
        seller_amount: sellerAmount,
        ...notes
      }
    }

    console.log('Razorpay order options:', JSON.stringify(options, null, 2))
    const razorpayOrder = await razorpay.orders.create(options)
    console.log('Razorpay response:', JSON.stringify(razorpayOrder, null, 2))

    console.log('Razorpay order created successfully:', razorpayOrder.id)

    // Update order with payment details
    if (orderId) {
      await supabase
        .from('orders')
        .update({
          razorpay_order_id: razorpayOrder.id,
          payment_status: 'pending',
          commission_amount: commissionAmount,
          seller_amount: sellerAmount
        })
        .eq('id', orderId)
    }

    return NextResponse.json({
      success: true,
      order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      receipt: razorpayOrder.receipt,
      commission_amount: commissionAmount,
      seller_amount: sellerAmount
    })

  } catch (error) {
    console.error('=== Payment Order Creation Error ===')
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    console.error('Full error:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Handle Razorpay specific errors
    if (error.error) {
      console.error('Razorpay error description:', error.error.description)
      return NextResponse.json({ 
        error: 'Payment order creation failed',
        message: error.error.description || 'Please try again'
      }, { status: 400 })
    }

    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message || 'Unable to create payment order'
    }, { status: 500 })
  }
}

// PATCH /api/payment/verify - Verify payment signature and credit seller wallets
export async function PATCH(request) {
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

    // Verify signature
    const crypto = require('crypto')
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    const isValid = expectedSignature === razorpay_signature

    if (!isValid) {
      return NextResponse.json({ 
        success: false,
        error: 'Invalid payment signature' 
      }, { status: 400 })
    }

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

      // Get order details
      const { data: order } = await supabase
        .from('orders')
        .select('seller_id, seller_amount, commission_amount, total_amount')
        .eq('id', order_id)
        .single()

      if (order && order.seller_id) {
        // Credit seller wallet (PENDING balance until delivery)
        await supabase.rpc('credit_seller_wallet_pending', {
          p_seller_id: order.seller_id,
          p_order_id: order_id,
          p_amount: order.seller_amount || (order.total_amount * 0.95),
          p_description: `Payment received for order - pending delivery confirmation`
        })

        // Record admin commission
        await supabase
          .from('admin_earnings')
          .insert({
            order_id: order_id,
            seller_id: order.seller_id,
            order_amount: order.total_amount,
            commission_rate: COMMISSION_RATE,
            commission_amount: order.commission_amount || (order.total_amount * 0.05),
            seller_amount: order.seller_amount || (order.total_amount * 0.95),
            status: 'earned'
          })

        console.log(`✅ Wallet credited (pending) for seller ${order.seller_id}: ₹${order.seller_amount}`)
        console.log(`💰 Admin commission: ₹${order.commission_amount}`)
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Payment verified successfully',
      payment_id: razorpay_payment_id
    })

  } catch (error) {
    console.error('Error verifying payment:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ 
      error: 'Payment verification failed',
      details: error.message
    }, { status: 500 })
  }
}
