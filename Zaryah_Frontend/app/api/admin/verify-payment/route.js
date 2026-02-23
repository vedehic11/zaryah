// Admin endpoint to manually verify and fix payment status
import { NextResponse } from 'next/server'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function POST(request) {
  try {
    const session = await requireAuth(request)
    const user = await getUserBySupabaseAuthId(session.user.id)

    if (!user || user.user_type !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { orderId, razorpayPaymentId } = await request.json()

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 })
    }

    console.log(`Admin manually verifying payment for order ${orderId}`)

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Update order to paid status
    await supabase
      .from('orders')
      .update({
        payment_status: 'paid',
        status: 'pending', // Reset to pending so seller can confirm it
        razorpay_payment_id: razorpayPaymentId || order.razorpay_payment_id || `manual_${Date.now()}`
      })
      .eq('id', orderId)

    console.log(`✅ Order ${orderId} manually marked as paid and reset to pending`)

    // Calculate and update seller wallet
    const sellerAmount = order.seller_amount || (order.total_amount * 0.95)
    const commissionAmount = order.commission_amount || (order.total_amount * 0.05)

    // Get or create seller wallet
    let { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('seller_id', order.seller_id)
      .maybeSingle()

    if (walletError) {
      console.error('Error fetching wallet:', walletError)
      throw new Error(`Failed to fetch wallet: ${walletError.message}`)
    }

    if (!wallet) {
      console.log(`Creating new wallet for seller ${order.seller_id}`)
      const { data: newWallet, error: createError } = await supabase
        .from('wallets')
        .insert({
          seller_id: order.seller_id,
          pending_balance: sellerAmount,
          available_balance: 0,
          total_earned: 0
        })
        .select()
        .single()
      
      if (createError) {
        console.error('Error creating wallet:', createError)
        throw new Error(`Failed to create wallet: ${createError.message}`)
      }
      
      if (!newWallet) {
        throw new Error('Wallet creation returned no data')
      }
      
      wallet = newWallet
      console.log(`✅ Created wallet ${wallet.id} for seller ${order.seller_id}`)
    } else {
      console.log(`Updating existing wallet ${wallet.id} for seller ${order.seller_id}`)
      const { error: updateError } = await supabase
        .from('wallets')
        .update({
          pending_balance: parseFloat(wallet.pending_balance) + sellerAmount
        })
        .eq('seller_id', order.seller_id)
      
      if (updateError) {
        console.error('Error updating wallet:', updateError)
        throw new Error(`Failed to update wallet: ${updateError.message}`)
      }
      
      console.log(`✅ Updated wallet balance - Pending: ${parseFloat(wallet.pending_balance) + sellerAmount}`)
    }

    // Create transaction record
    console.log(`Creating transaction for seller ${order.seller_id}`)
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert({
        seller_id: order.seller_id,
        type: 'credit_pending',
        amount: sellerAmount,
        status: 'completed',
        description: `Payment for order #${orderId} (Manual verification)`,
        order_id: orderId,
        metadata: {
          payment_id: razorpayPaymentId || order.razorpay_payment_id,
          commission_amount: commissionAmount
        }
      })
    
    if (transactionError) {
      console.error('Error creating transaction:', transactionError)
      throw new Error(`Failed to create transaction: ${transactionError.message}`)
    }
    
    console.log(`✅ Transaction created successfully`)

    return NextResponse.json({
      success: true,
      message: `Order ${orderId} payment verified manually`,
      order: {
        id: orderId,
        payment_status: 'paid',
        seller_amount: sellerAmount,
        commission_amount: commissionAmount
      }
    })

  } catch (error) {
    console.error('Manual payment verification error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to verify payment' 
    }, { status: 500 })
  }
}
