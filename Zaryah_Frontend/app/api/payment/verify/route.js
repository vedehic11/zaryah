// POST /api/payment/verify - Verify Razorpay payment signature and credit seller wallets
import { NextResponse } from 'next/server'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import crypto from 'crypto'

// Commission: 2.5% from seller + Platform fee (₹10 or ₹20) from buyer
const SELLER_COMMISSION_RATE = 2.5

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

      // Get order details with order items to calculate product subtotal
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
        // Use seller_amount from order (includes 97.5% of products + 100% gift packaging fees)
        const sellerAmount = parseFloat(order.seller_amount || 0)
        const productSubtotal = (order.order_items || []).reduce((sum, item) => 
          sum + (parseFloat(item.price) * item.quantity), 0
        )
        const giftPackagingFee = parseFloat(order.gift_packaging_fee || 0)
        const sellerCommission = parseFloat((productSubtotal * 0.025).toFixed(2))
        const buyerPlatformFee = parseFloat(order.platform_fee || 0)
        const deliveryMarkup = 10 // Platform keeps ₹10 markup on delivery (rest goes to Shiprocket)
        const codFee = order.payment_method === 'cod' ? 10 : 0 // ₹10 COD fee
        const totalAdminEarnings = sellerCommission + buyerPlatformFee + deliveryMarkup + codFee
        
        console.log('💰 SELLER EARNINGS CALCULATED (from payment verification):')
        console.log('  Product subtotal:', `₹${productSubtotal}`)
        console.log('  Gift packaging fees:', `₹${giftPackagingFee}`)
        console.log('  Seller amount (97.5% + gift fees):', `₹${sellerAmount}`)
        console.log('  Seller commission (2.5% from seller):', `₹${sellerCommission}`)
        console.log('  Buyer platform fee (₹10 or ₹20):', `₹${buyerPlatformFee}`)
        console.log('  Delivery markup (₹10 to admin):', `₹${deliveryMarkup}`)
        console.log('  COD fee:', `₹${codFee}`)
        console.log('  Total admin earnings:', `₹${totalAdminEarnings}`)

        // Ensure wallet exists and add to pending balance
        const { data: existingWallet } = await supabase
          .from('wallets')
          .select('id, pending_balance')
          .eq('seller_id', order.seller_id)
          .single()

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
          // Update existing wallet - add to pending balance
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

        // Record admin commission (recorded once at payment verification)
        const { error: commissionError } = await supabase
          .from('admin_earnings')
          .insert({
            order_id: order_id,
            seller_id: order.seller_id,
            order_amount: productSubtotal,
            commission_rate: 2.5, // 2.5% from seller only
            commission_amount: sellerCommission, // Only seller commission (2.5%)
            delivery_fee: deliveryMarkup, // Only the ₹10 markup, not full delivery fee
            status: 'earned',
            earned_at: new Date().toISOString()
          })

        if (commissionError) {
          console.error('Commission record error:', commissionError)
        } else {
          console.log(`💰 Admin earnings recorded: ₹${totalAdminEarnings} (₹${sellerCommission} seller commission + ₹${buyerPlatformFee} platform fee + ₹${deliveryMarkup} delivery markup + ₹${codFee} COD fee)`)
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
