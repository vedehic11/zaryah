// Next.js API route for admin to approve/process withdrawal
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import Razorpay from 'razorpay'

// Initialize Razorpay instance for payouts
const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

// POST /api/admin/withdrawals/[id]/approve - Approve and process withdrawal
export async function POST(request, { params }) {
  try {
    const { id } = await params
    const { user } = await requireRole(request, 'Admin')

    const body = await request.json()
    const { action, rejection_reason } = body // action: 'approve' or 'reject'

    // Get withdrawal request
    const { data: withdrawal, error: fetchError } = await supabase
      .from('withdrawal_requests')
      .select(`
        *,
        sellers:seller_id (
          full_name,
          business_name,
          account_number,
          ifsc_code,
          account_holder_name
        )
      `)
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
      // Check if Razorpay payout is enabled
      const useRazorpayPayout = process.env.RAZORPAY_PAYOUT_ENABLED === 'true'

      let razorpayPayoutId = null

      if (useRazorpayPayout) {
        try {
          // Create Razorpay payout
          const payout = await razorpay.payouts.create({
            account_number: process.env.RAZORPAY_ACCOUNT_NUMBER, // Your Razorpay account
            amount: withdrawal.amount * 100, // Convert to paise
            currency: 'INR',
            mode: 'NEFT', // or 'IMPS', 'RTGS'
            purpose: 'payout',
            fund_account: {
              account_type: 'bank_account',
              bank_account: {
                name: withdrawal.sellers.account_holder_name || withdrawal.account_holder_name,
                ifsc: withdrawal.sellers.ifsc_code || withdrawal.ifsc_code,
                account_number: withdrawal.sellers.account_number || withdrawal.bank_account_number
              }
            },
            queue_if_low_balance: false,
            reference_id: `withdrawal_${id}`,
            narration: `Seller payout - ${withdrawal.sellers.business_name}`
          })

          razorpayPayoutId = payout.id

          console.log(`✅ Razorpay payout created: ${razorpayPayoutId}`)
        } catch (payoutError) {
          console.error('Razorpay payout error:', payoutError)
          
          // Mark as failed
          await supabase
            .from('withdrawal_requests')
            .update({
              status: 'failed',
              processed_at: new Date().toISOString(),
              processed_by: user.id,
              failure_reason: payoutError.error?.description || 'Payout failed'
            })
            .eq('id', id)

          return NextResponse.json({ 
            error: 'Payout creation failed',
            details: payoutError.error?.description 
          }, { status: 500 })
        }
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
            p_razorpay_payout_id: razorpayPayoutId
          })

        if (processError) {
          throw new Error(`Withdrawal processing failed: ${processError.message}`)
        }

        return NextResponse.json({
          success: true,
          message: 'Withdrawal processed successfully',
          payout_id: razorpayPayoutId,
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
