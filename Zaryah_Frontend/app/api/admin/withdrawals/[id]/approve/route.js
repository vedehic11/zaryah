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
        // Create transaction record
        const { data: transaction, error: txError } = await supabase
          .from('transactions')
          .insert({
            seller_id: withdrawal.seller_id,
            amount: -withdrawal.amount, // Negative for debit
            type: 'debit_withdrawal',
            description: `Withdrawal to bank account ending in ${withdrawal.bank_account_number.slice(-4)}`,
            status: 'completed',
            created_by: user.id
          })
          .select()
          .single()

        if (txError) {
          throw new Error(`Transaction creation failed: ${txError.message}`)
        }

        // Call the database function to process withdrawal
        const { data: result, error: processError } = await supabase
          .rpc('process_withdrawal', {
            p_withdrawal_id: id,
            p_transaction_id: transaction.id,
            p_razorpay_payout_id: null
          })

        if (processError) {
          throw new Error(`Withdrawal processing failed: ${processError.message}`)
        }

        const { error: metaUpdateError } = await supabase
          .from('withdrawal_requests')
          .update({
            manual_transaction_id: normalizedManualTransactionId
          })
          .eq('id', id)

        if (metaUpdateError) {
          throw new Error(`Unable to save manual transaction ID: ${metaUpdateError.message}`)
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
