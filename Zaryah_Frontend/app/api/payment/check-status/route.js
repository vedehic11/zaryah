// Check payment status from Razorpay
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import Razorpay from 'razorpay'

const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

export async function POST(request) {
  try {
    await requireAuth(request)
    
    const { razorpayOrderId } = await request.json()

    if (!razorpayOrderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 })
    }

    // Fetch order details from Razorpay
    const order = await razorpay.orders.fetch(razorpayOrderId)
    
    // Fetch payments for this order
    const payments = await razorpay.orders.fetchPayments(razorpayOrderId)

    const latestPayment = payments.items?.[0]

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        status: order.status, // created, attempted, paid
        amount: order.amount,
        amount_paid: order.amount_paid,
        amount_due: order.amount_due
      },
      payment: latestPayment ? {
        id: latestPayment.id,
        status: latestPayment.status, // created, authorized, captured, failed
        method: latestPayment.method,
        amount: latestPayment.amount,
        captured: latestPayment.captured,
        error_code: latestPayment.error_code,
        error_description: latestPayment.error_description
      } : null
    })

  } catch (error) {
    console.error('Payment status check error:', error)
    return NextResponse.json({ 
      error: error.error?.description || error.message 
    }, { status: 500 })
  }
}
