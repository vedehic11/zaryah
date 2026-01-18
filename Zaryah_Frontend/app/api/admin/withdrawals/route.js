// Next.js API route for admin withdrawal management
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import Razorpay from 'razorpay'

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

// GET /api/admin/withdrawals - Get all withdrawal requests
export async function GET(request) {
  try {
    const { user } = await requireRole(request, 'Admin')

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // pending, approved, completed, etc.

    let query = supabase
      .from('withdrawal_requests')
      .select('*')
      .order('requested_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data: withdrawals, error } = await query

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch seller details separately for each withdrawal
    if (withdrawals && withdrawals.length > 0) {
      for (let withdrawal of withdrawals) {
        if (withdrawal.seller_id) {
          const { data: seller } = await supabase
            .from('sellers')
            .select('id, business_name, full_name, primary_mobile')
            .eq('id', withdrawal.seller_id)
            .single()
          
          if (seller) {
            withdrawal.sellers = seller
            
            // Fetch user email
            const { data: userProfile } = await supabase
              .from('users')
              .select('email')
              .eq('id', seller.id)
              .single()
            
            if (userProfile) {
              withdrawal.sellers.users = userProfile
            }
          }
        }
      }
    }

    return NextResponse.json({ withdrawals: withdrawals || [] })

  } catch (error) {
    console.error('Error fetching withdrawals:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}
