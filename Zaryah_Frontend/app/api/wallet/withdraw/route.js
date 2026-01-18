// Next.js API route for seller withdrawal requests
import { NextResponse } from 'next/server'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// Minimum withdrawal amount
const MIN_WITHDRAWAL_AMOUNT = 500

// POST /api/wallet/withdraw - Create withdrawal request
export async function POST(request) {
  try {
    const session = await requireAuth(request)
    const user = await getUserBySupabaseAuthId(session.user.id)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Only sellers can withdraw
    if (user.user_type !== 'Seller') {
      return NextResponse.json({ error: 'Only sellers can withdraw funds' }, { status: 403 })
    }

    const body = await request.json()
    const { amount, bank_account_number, ifsc_code, account_holder_name, notes } = body

    // Validate input
    if (!amount || amount < MIN_WITHDRAWAL_AMOUNT) {
      return NextResponse.json({ 
        error: `Minimum withdrawal amount is ₹${MIN_WITHDRAWAL_AMOUNT}` 
      }, { status: 400 })
    }

    if (!bank_account_number || !ifsc_code || !account_holder_name) {
      return NextResponse.json({ 
        error: 'Bank details are required' 
      }, { status: 400 })
    }

    // Validate IFSC code format
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/
    if (!ifscRegex.test(ifsc_code)) {
      return NextResponse.json({ 
        error: 'Invalid IFSC code format' 
      }, { status: 400 })
    }

    // Get seller details for KYC check
    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .select('id, full_name, account_number, ifsc_code, account_holder_name')
      .eq('id', user.id)
      .single()

    if (sellerError || !seller) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 })
    }

    // Check if KYC details exist
    if (!seller.account_number || !seller.ifsc_code) {
      return NextResponse.json({ 
        error: 'Please complete KYC and add bank details before withdrawal',
        action: 'complete_kyc'
      }, { status: 400 })
    }

    // Get wallet
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('available_balance')
      .eq('seller_id', user.id)
      .single()

    if (walletError || !wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
    }

    // Check if sufficient balance
    if (wallet.available_balance < amount) {
      return NextResponse.json({ 
        error: 'Insufficient available balance',
        available: wallet.available_balance,
        requested: amount
      }, { status: 400 })
    }

    // Check for pending withdrawal requests
    const { data: pendingWithdrawals } = await supabase
      .from('withdrawal_requests')
      .select('id')
      .eq('seller_id', user.id)
      .in('status', ['pending', 'approved', 'processing'])

    if (pendingWithdrawals && pendingWithdrawals.length > 0) {
      return NextResponse.json({ 
        error: 'You already have a pending withdrawal request',
        action: 'wait_for_processing'
      }, { status: 400 })
    }

    // Create withdrawal request
    const { data: withdrawal, error: createError } = await supabase
      .from('withdrawal_requests')
      .insert({
        seller_id: user.id,
        amount: amount,
        bank_account_number: bank_account_number,
        ifsc_code: ifsc_code.toUpperCase(),
        account_holder_name: account_holder_name,
        status: 'pending',
        notes: notes || null
      })
      .select()
      .single()

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      withdrawal,
      note: 'Your request will be processed within 2-3 business days'
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating withdrawal request:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/wallet/withdraw - Get withdrawal history
export async function GET(request) {
  try {
    const session = await requireAuth(request)
    const user = await getUserBySupabaseAuthId(session.user.id)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.user_type !== 'Seller') {
      return NextResponse.json({ error: 'Only sellers can view withdrawals' }, { status: 403 })
    }

    // Get withdrawal requests
    const { data: withdrawals, error } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('seller_id', user.id)
      .order('requested_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ withdrawals: withdrawals || [] })

  } catch (error) {
    console.error('Error fetching withdrawals:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
