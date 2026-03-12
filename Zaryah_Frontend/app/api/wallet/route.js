// Next.js API route for seller wallet management
import { NextResponse } from 'next/server'
import { requireAuth, getUserBySupabaseAuthId, requireRole } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// GET /api/wallet - Get seller's wallet balance and transactions
export async function GET(request) {
  try {
    const session = await requireAuth(request)
    const user = await getUserBySupabaseAuthId(session.user.id)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Only sellers can access wallet
    if (user.user_type !== 'Seller') {
      return NextResponse.json({ error: 'Only sellers have wallets' }, { status: 403 })
    }

    // Calculate wallet balances from actual orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        status,
        payment_status,
        payment_method,
        order_items (
          quantity,
          price,
          gift_packaging
        )
      `)
      .eq('seller_id', user.id)

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
      return NextResponse.json({ error: ordersError.message }, { status: 500 })
    }

    // Calculate pending balance: Sum of 97.5% of products + 100% of gift fees for pending/confirmed/dispatched orders
    // Include: online orders with payment_status='paid' OR COD orders (payment on delivery)
    const pendingOrders = orders.filter(o => 
      ['pending', 'confirmed', 'dispatched'].includes(o.status) && 
      (o.payment_status === 'paid' || o.payment_method === 'cod')
    )

    const pending_balance = pendingOrders.reduce((sum, order) => {
      const productSubtotal = (order.order_items || []).reduce((itemSum, item) => 
        itemSum + (item.quantity * item.price), 0
      )
      const giftItemsCount = (order.order_items || []).reduce((count, item) => 
        count + (item.gift_packaging ? item.quantity : 0), 0
      )
      const giftFees = giftItemsCount * 10
      return sum + parseFloat((productSubtotal * 0.975).toFixed(2)) + giftFees
    }, 0)

    // Calculate total earned: Sum of 97.5% of products + 100% of gift fees for all delivered orders
    const deliveredOrders = orders.filter(o => o.status === 'delivered')

    const total_earned = deliveredOrders.reduce((sum, order) => {
      const productSubtotal = (order.order_items || []).reduce((itemSum, item) => 
        itemSum + (item.quantity * item.price), 0
      )
      const giftItemsCount = (order.order_items || []).reduce((count, item) => 
        count + (item.gift_packaging ? item.quantity : 0), 0
      )
      const giftFees = giftItemsCount * 10
      return sum + parseFloat((productSubtotal * 0.975).toFixed(2)) + giftFees
    }, 0)

    // Get total withdrawn amount
    const { data: completedWithdrawals } = await supabase
      .from('withdrawal_requests')
      .select('amount')
      .eq('seller_id', user.id)
      .eq('status', 'completed')

    const total_withdrawn = (completedWithdrawals || []).reduce((sum, w) => sum + parseFloat(w.amount), 0)

    // Available balance = Total earned - Total withdrawn
    const available_balance = total_earned - total_withdrawn

    // Get or create wallet record (just for reference, not for storing balances)
    let { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('seller_id', user.id)
      .single()

    if (walletError && walletError.code === 'PGRST116') {
      // Create wallet if doesn't exist
      const { data: newWallet, error: createError } = await supabase
        .from('wallets')
        .insert({ 
          seller_id: user.id,
          pending_balance: pending_balance,
          available_balance: available_balance,
          total_earned: total_earned
        })
        .select()
        .single()

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 })
      }

      wallet = newWallet
    } else if (walletError) {
      return NextResponse.json({ error: walletError.message }, { status: 500 })
    } else {
      // Update wallet with calculated values
      const { data: updatedWallet, error: updateError } = await supabase
        .from('wallets')
        .update({
          pending_balance: pending_balance,
          available_balance: available_balance,
          total_earned: total_earned
        })
        .eq('seller_id', user.id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating wallet:', updateError)
      } else {
        wallet = updatedWallet
      }
    }

    console.log('💳 WALLET CALCULATED FROM ORDERS:', {
      pending_orders: pendingOrders.length,
      delivered_orders: deliveredOrders.length,
      pending_balance: `₹${pending_balance.toFixed(2)}`,
      total_earned: `₹${total_earned.toFixed(2)}`,
      total_withdrawn: `₹${total_withdrawn.toFixed(2)}`,
      available_balance: `₹${available_balance.toFixed(2)}`
    })

    // Get recent transactions
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('*')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (transactionsError) {
      return NextResponse.json({ error: transactionsError.message }, { status: 500 })
    }

    // Get withdrawal requests
    const { data: withdrawals, error: withdrawalsError } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('seller_id', user.id)
      .order('requested_at', { ascending: false })
      .limit(20)

    if (withdrawalsError) {
      return NextResponse.json({ error: withdrawalsError.message }, { status: 500 })
    }

    console.log('  Transactions count:', transactions?.length || 0)
    console.log('  Withdrawals count:', withdrawals?.length || 0)
    
    // Log transaction details for debugging
    if (transactions && transactions.length > 0) {
      console.log('  Recent transactions:')
      transactions.slice(0, 5).forEach((txn, i) => {
        console.log(`    ${i + 1}. ${txn.type}: ₹${txn.amount} - ${txn.status} - ${txn.description}`)
      })
    }

    return NextResponse.json({
      wallet,
      transactions: transactions || [],
      withdrawals: withdrawals || []
    })

  } catch (error) {
    console.error('Error fetching wallet:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
