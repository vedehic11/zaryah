// Next.js API route for payment initiation with PhonePe Standard Checkout SDK
import { NextResponse } from 'next/server'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { StandardCheckoutClient, StandardCheckoutPayRequest, Env } from '@phonepe-pg/pg-sdk-node'
import { randomUUID } from 'crypto'

// Singleton PhonePe client
let phonepeClient = null
function getPhonePeClient() {
  if (!phonepeClient) {
    const env = process.env.PHONEPE_ENV === 'PRODUCTION' ? Env.PRODUCTION : Env.SANDBOX
    phonepeClient = StandardCheckoutClient.getInstance(
      process.env.PHONEPE_CLIENT_ID,
      process.env.PHONEPE_CLIENT_SECRET,
      parseInt(process.env.PHONEPE_CLIENT_VERSION || '1'),
      env
    )
  }
  return phonepeClient
}

const SELLER_COMMISSION_RATE = 2.5

// POST /api/payment/create-order - Initiate PhonePe payment and get redirect URL
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

    let orderFinancials = null

    // SECURITY: Validate amount matches order total if orderId provided
    if (orderId) {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('total_amount, commission_amount, seller_amount')
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

      orderFinancials = {
        commissionAmount: parseFloat(order.commission_amount || 0),
        sellerAmount: parseFloat(order.seller_amount || 0)
      }
    }

    // Check if PhonePe is configured
    if (!process.env.PHONEPE_CLIENT_ID || !process.env.PHONEPE_CLIENT_SECRET) {
      console.error('PhonePe credentials not configured')
      return NextResponse.json({ 
        error: 'Payment system not configured',
        message: 'Please contact support'
      }, { status: 500 })
    }

    // Generate unique merchant order ID
    const merchantOrderId = `ORD_${Date.now()}_${user.id.substring(0, 8)}`

    console.log('Creating PhonePe payment with amount (paise):', amount, 'for order:', orderId)

    // Calculate commission/seller amounts
    const orderAmountInRupees = parseFloat(amount) / 100
    const commissionAmount = orderFinancials
      ? orderFinancials.commissionAmount
      : parseFloat((orderAmountInRupees * 0.025).toFixed(2))
    const sellerAmount = orderFinancials
      ? orderFinancials.sellerAmount
      : parseFloat((orderAmountInRupees - commissionAmount).toFixed(2))

    // Determine redirect URL
    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://zaryah.in'
    const redirectUrl = `${origin}/payment/callback?merchantOrderId=${merchantOrderId}`

    // Build payment request using SDK
    const client = getPhonePeClient()
    const payRequest = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(Math.round(amount)) // Already in paise
      .redirectUrl(redirectUrl)
      .build()

    console.log('PhonePe payment request prepared, merchantOrderId:', merchantOrderId)

    const response = await client.pay(payRequest)
    const checkoutPageUrl = response.redirectUrl

    if (!checkoutPageUrl) {
      console.error('No redirect URL in PhonePe response:', response)
      return NextResponse.json({
        error: 'Payment initiation failed',
        message: 'No payment page URL received'
      }, { status: 500 })
    }

    console.log('PhonePe payment initiated successfully:', merchantOrderId)

    // Update order with payment details
    if (orderId) {
      await supabase
        .from('orders')
        .update({
          payment_id: merchantOrderId,
          payment_status: 'pending'
        })
        .eq('id', orderId)
    }

    return NextResponse.json({
      success: true,
      merchantTransactionId: merchantOrderId,
      redirectUrl: checkoutPageUrl,
      amount: Math.round(amount),
      currency: currency,
      commission_amount: commissionAmount,
      seller_amount: sellerAmount
    })

  } catch (error) {
    console.error('=== Payment Initiation Error ===')
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message || 'Unable to initiate payment'
    }, { status: 500 })
  }
}
