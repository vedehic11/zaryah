// Next.js API route for admin to approve/process withdrawal
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// POST /api/admin/withdrawals/[id]/approve - Approve and process withdrawal
export async function POST(request, { params }) {
  try {
    const { id } = await params
    const { user } = await requireRole(request, 'Admin')

    const body = await request.json()
    const { action, rejection_reason, manual_transaction_id } = body // action: 'approve' or 'reject'

    // Get withdrawal request
    const { data: withdrawal, error: fetchError } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !withdrawal) {
      return NextResponse.json({ error: 'Withdrawal request not found' }, { status: 404 })
    }

    if (withdrawal.status !== 'pending') {
      return NextResponse.json({ 
        error: `Cannot process withdrawal in ${withdrawal.status} status` 
      }, { status: 400 })
    }

    // Handle rejection
    if (action === 'reject') {
      const { error: rejectError } = await supabase
        .from('withdrawal_requests')
        .update({
          status: 'rejected',
          processed_at: new Date().toISOString(),
          processed_by: user.id,
          failure_reason: rejection_reason || 'Rejected by admin'
        })
        .eq('id', id)

      if (rejectError) {
        return NextResponse.json({ error: rejectError.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Withdrawal request rejected'
      })
    }

    // Handle approval and processing
    if (action === 'approve') {
      const normalizedManualTransactionId = (manual_transaction_id || '').toString().trim()
      if (!normalizedManualTransactionId) {
        return NextResponse.json({
          error: 'Manual transaction ID is required for payout approval'
        }, { status: 400 })
      }

      // Process withdrawal using database function
      try {
        // Fetch seller wallet details
        const { data: wallet, error: walletFetchError } = await supabase
          .from('wallets')
          .select('id, available_balance, total_withdrawn')
          .eq('seller_id', withdrawal.seller_id)
          .single()

        if (walletFetchError || !wallet) {
          throw new Error(`Wallet not found for seller: ${walletFetchError?.message || 'Not found'}`)
        }

        const currentAvailable = parseFloat(wallet.available_balance || 0)
        const currentWithdrawn = parseFloat(wallet.total_withdrawn || 0)
        const amount = parseFloat(withdrawal.amount)

        if (currentAvailable < amount) {
          throw new Error('Wallet balance is insufficient for this withdrawal')
        }

        // 1. Update wallet balance (debit)
        const { error: walletUpdateError } = await supabase
          .from('wallets')
          .update({
            available_balance: currentAvailable - amount,
            total_withdrawn: currentWithdrawn + amount,
            last_withdrawal_at: new Date().toISOString()
          })
          .eq('id', wallet.id)

        if (walletUpdateError) {
          throw new Error(`Failed to update wallet balances: ${walletUpdateError.message}`)
        }

        // 2. Create transaction record
        const { data: transaction, error: txError } = await supabase
          .from('transactions')
          .insert({
            seller_id: withdrawal.seller_id,
            amount: -amount, // Negative for debit
            type: 'debit_withdrawal',
            description: `Withdrawal to UPI ID ${withdrawal.bank_account_number || 'unknown'}`,
            status: 'completed',
            created_by: user.id
          })
          .select()
          .single()

        if (txError) {
          throw new Error(`Transaction creation failed: ${txError.message}`)
        }

        // 3. Update withdrawal_requests record directly (status is completed)
        const { error: metaUpdateError } = await supabase
          .from('withdrawal_requests')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString(),
            processed_by: user.id,
            manual_transaction_id: normalizedManualTransactionId,
            transaction_id: transaction ? transaction.id : null
          })
          .eq('id', id)

        if (metaUpdateError) {
          throw new Error(`Unable to update withdrawal request: ${metaUpdateError.message}`)
        }

        return NextResponse.json({
          success: true,
          message: 'Withdrawal marked completed manually',
          payout_mode: 'manual',
          manual_transaction_id: normalizedManualTransactionId,
          transaction_id: transaction.id
        })

      } catch (dbError) {
        console.error('Database error:', dbError)

        // Mark as failed
        await supabase
          .from('withdrawal_requests')
          .update({
            status: 'failed',
            processed_at: new Date().toISOString(),
            processed_by: user.id,
            failure_reason: dbError.message
          })
          .eq('id', id)

        return NextResponse.json({ 
          error: 'Withdrawal processing failed',
          details: dbError.message 
        }, { status: 500 })
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Error processing withdrawal:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 })
  }
}
