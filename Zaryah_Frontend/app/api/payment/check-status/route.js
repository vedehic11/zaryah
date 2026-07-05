// Check payment status from PhonePe using SDK
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { StandardCheckoutClient, Env } from '@phonepe-pg/pg-sdk-node'

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

export async function POST(request) {
  try {
    await requireAuth(request)
    
    const { merchantTransactionId, merchantOrderId } = await request.json()
    const orderId = merchantOrderId || merchantTransactionId

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 })
    }

    // Fetch status using SDK
    const client = getPhonePeClient()
    const statusResult = await client.getOrderStatus(orderId)

    const paymentState = statusResult?.state || 'UNKNOWN'
    const isSuccess = paymentState === 'COMPLETED'

    // Map PhonePe states to frontend-compatible format
    let mappedStatus = 'created'
    if (paymentState === 'COMPLETED') mappedStatus = 'captured'
    else if (paymentState === 'FAILED') mappedStatus = 'failed'
    else if (paymentState === 'PENDING') mappedStatus = 'created'

    return NextResponse.json({
      success: true,
      order: {
        id: orderId,
        status: isSuccess ? 'paid' : paymentState.toLowerCase(),
        amount: statusResult?.amount || 0,
        amount_paid: isSuccess ? (statusResult?.amount || 0) : 0,
        amount_due: isSuccess ? 0 : (statusResult?.amount || 0)
      },
      payment: {
        id: statusResult?.transactionId || orderId,
        status: mappedStatus,
        method: statusResult?.paymentInstrument?.type || 'UNKNOWN',
        amount: statusResult?.amount || 0,
        captured: isSuccess,
        error_code: isSuccess ? null : statusResult?.code,
        error_description: isSuccess ? null : statusResult?.message
      }
    })

  } catch (error) {
    console.error('Payment status check error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to check payment status'
    }, { status: 500 })
  }
}
