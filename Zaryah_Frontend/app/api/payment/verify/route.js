// POST /api/payment/verify - Verify PhonePe payment using SDK and credit seller wallets
import { NextResponse } from 'next/server'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { StandardCheckoutClient, Env } from '@phonepe-pg/pg-sdk-node'
import { sendSellerOrderNotificationIfNeeded } from '@/lib/order-notifications'

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

export async function POST(request) {
  try {
    const session = await requireAuth(request)
    const user = await getUserBySupabaseAuthId(session.user.id)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { merchantTransactionId, merchantOrderId, order_id } = body
    const orderId = merchantOrderId || merchantTransactionId

    if (!orderId) {
      return NextResponse.json({ error: 'Missing merchantOrderId' }, { status: 400 })
    }

    console.log('Verifying PhonePe payment:', { merchantOrderId: orderId, order_id })

    // Check payment status using SDK
    const client = getPhonePeClient()
    const statusResult = await client.getOrderStatus(orderId)

    console.log('PhonePe status response:', JSON.stringify(statusResult, null, 2))

    const paymentState = statusResult?.state || statusResult?.code
    const isPaymentSuccess = paymentState === 'COMPLETED'

    if (!isPaymentSuccess) {
      console.error('PhonePe payment not successful. State:', paymentState)
      return NextResponse.json({ 
        success: false,
        error: 'Payment not completed',
        state: paymentState,
        message: 'Payment verification failed'
      }, { status: 400 })
    }

    const phonePeTransactionId = statusResult?.transactionId || orderId

    console.log('✅ PhonePe payment verified. Transaction ID:', phonePeTransactionId)

    // Payment verified! Now process wallet credits
    if (order_id) {
      // Update order payment status
      await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          status: 'confirmed',
          payment_id: orderId
        })
        .eq('id', order_id)

      console.log(`Order ${order_id} marked as paid`)

      // Get order details with order items
      const { data: order } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            quantity,
            price
          )
        `)
        .eq('id', order_id)
        .single()

      if (order && order.seller_id) {
          const { data: existingCreditTx, error: existingCreditTxError } = await supabase
            .from('transactions')
            .select('id')
            .eq('order_id', order_id)
            .eq('type', 'credit_pending')
            .limit(1)
            .maybeSingle()

          if (existingCreditTxError) {
            console.error('Error checking existing payment credit transaction:', existingCreditTxError)
          }

          if (existingCreditTx) {
            console.log(`Payment for order ${order_id} was already credited, skipping duplicate wallet/admin updates`)
            return NextResponse.json({
              success: true,
              message: 'Payment already verified',
              payment_id: phonePeTransactionId,
              idempotent: true
            })
          }

        // Use seller_amount from order
        const sellerAmount = parseFloat(order.seller_amount || 0)
        const productSubtotal = (order.order_items || []).reduce((sum, item) => 
          sum + (parseFloat(item.price) * item.quantity), 0
        )
        const giftPackagingFee = parseFloat(order.gift_packaging_fee || 0)
        const sellerCommission = parseFloat((productSubtotal * (SELLER_COMMISSION_RATE / 100)).toFixed(2))
        const buyerPlatformFee = parseFloat(order.platform_fee || 0)
        const deliveryMarkup = parseFloat(order.delivery_fee || 0) > 0 ? 10 : 0
        const totalAdminEarnings = sellerCommission + buyerPlatformFee + deliveryMarkup
        
        console.log('💰 SELLER EARNINGS CALCULATED (from payment verification):')
        console.log('  Product subtotal:', `₹${productSubtotal}`)
        console.log('  Gift packaging fees:', `₹${giftPackagingFee}`)
        console.log('  Seller amount (97.5% + gift fees):', `₹${sellerAmount}`)
        console.log('  Seller commission (2.5% from seller):', `₹${sellerCommission}`)
        console.log('  Buyer platform fee (₹10 or ₹20):', `₹${buyerPlatformFee}`)
        console.log('  Delivery markup (₹10 to admin):', `₹${deliveryMarkup}`)
        console.log('  Total admin earnings:', `₹${totalAdminEarnings}`)

        // Ensure wallet exists and add to pending balance
        const { data: existingWallet } = await supabase
          .from('wallets')
          .select('id, pending_balance')
          .eq('seller_id', order.seller_id)
          .maybeSingle()

        if (!existingWallet) {
          await supabase
            .from('wallets')
            .insert({
              seller_id: order.seller_id,
              pending_balance: sellerAmount,
              available_balance: 0,
              total_earned: 0
            })
          console.log('  Wallet created with pending balance:', sellerAmount)
        } else {
          const currentPending = parseFloat(existingWallet.pending_balance || 0)
          await supabase
            .from('wallets')
            .update({
              pending_balance: currentPending + sellerAmount,
              updated_at: new Date().toISOString()
            })
            .eq('seller_id', order.seller_id)
          console.log('  Pending balance updated +₹' + sellerAmount)
        }
        
        // Create transaction record for pending credit
        await supabase
          .from('transactions')
          .insert({
            seller_id: order.seller_id,
            order_id: order_id,
            type: 'credit_pending',
            amount: sellerAmount,
            status: 'completed',
            description: `Payment verified - Pending delivery confirmation`
          })

        // Record admin commission
        const { error: commissionError } = await supabase
          .from('admin_earnings')
          .insert({
            order_id: order_id,
            seller_id: order.seller_id,
            order_amount: productSubtotal,
            commission_rate: SELLER_COMMISSION_RATE,
            commission_amount: sellerCommission,
            delivery_fee: deliveryMarkup,
            status: 'earned',
            earned_at: new Date().toISOString()
          })

        if (commissionError) {
          console.error('Commission record error:', commissionError)
        } else {
          console.log(`💰 Admin earnings recorded: ₹${totalAdminEarnings}`)
        }

        const notificationResult = await sendSellerOrderNotificationIfNeeded({
          order,
          totalAmount: parseFloat(order.total_amount || 0),
          items: (order.order_items || []).map((item) => ({
            name: item.product_name || 'Product',
            quantity: item.quantity,
            price: item.price
          }))
        })

        if (notificationResult.sent) {
          console.log('✅ Seller email sent after payment verification for order:', order_id)
        } else {
          console.log('ℹ️ Seller email not sent after payment verification:', notificationResult.reason)
        }
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Payment verified successfully',
      payment_id: phonePeTransactionId
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
