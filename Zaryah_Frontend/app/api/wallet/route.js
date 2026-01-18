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

    // Get wallet
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('seller_id', user.id)
      .single()

    if (walletError && walletError.code === 'PGRST116') {
      // Create wallet if doesn't exist
      const { data: newWallet, error: createError } = await supabase
        .from('wallets')
        .insert({ seller_id: user.id })
        .select()
        .single()

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 })
      }

      return NextResponse.json({
        wallet: newWallet,
        transactions: [],
        withdrawals: []
      })
    }

    if (walletError) {
      return NextResponse.json({ error: walletError.message }, { status: 500 })
    }

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
