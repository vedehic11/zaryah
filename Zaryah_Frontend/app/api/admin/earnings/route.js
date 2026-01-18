// Next.js API route for admin commission earnings
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// GET /api/admin/earnings - Get platform commission earnings
export async function GET(request) {
  try {
    const { user } = await requireRole(request, 'Admin')

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'all' // all, today, week, month, year
    const sellerId = searchParams.get('seller_id')

    let query = supabase
      .from('admin_earnings')
      .select('*')
      .eq('status', 'earned')
      .order('earned_at', { ascending: false })
      .limit(100) // Limit to recent 100 for performance

    // Filter by seller if specified
    if (sellerId) {
      query = query.eq('seller_id', sellerId)
    }

    // Filter by period
    const now = new Date()
    if (period === 'today') {
      const startOfDay = new Date(now.setHours(0, 0, 0, 0))
      query = query.gte('earned_at', startOfDay.toISOString())
    } else if (period === 'week') {
      const startOfWeek = new Date(now.setDate(now.getDate() - 7))
      query = query.gte('earned_at', startOfWeek.toISOString())
    } else if (period === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      query = query.gte('earned_at', startOfMonth.toISOString())
    } else if (period === 'year') {
      const startOfYear = new Date(now.getFullYear(), 0, 1)
      query = query.gte('earned_at', startOfYear.toISOString())
    }

    const { data: earnings, error } = await query

    if (error) {
      console.error('Supabase error fetching earnings:', error)
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }

    // Handle empty results
    if (!earnings || earnings.length === 0) {
      return NextResponse.json({
        recentEarnings: [],
        totalCommission: 0,
        totalOrders: 0,
        avgPerOrder: 0,
        commissionRate: 5.0
      })
    }

    // Fetch related data separately
    for (let earning of earnings) {
      // Fetch seller details
      if (earning.seller_id) {
        try {
          const { data: seller } = await supabase
            .from('sellers')
            .select('business_name, full_name')
            .eq('id', earning.seller_id)
            .single()
          
          if (seller) {
            earning.sellers = seller
          }
        } catch (err) {
          console.error('Error fetching seller:', err)
          // Continue even if seller fetch fails
        }
      }
    }

    // Calculate summary statistics
    const totalCommission = earnings.reduce((sum, e) => sum + parseFloat(e.commission_amount || 0), 0)
    const totalOrders = earnings.length
    const avgCommissionPerOrder = totalOrders > 0 ? totalCommission / totalOrders : 0

    return NextResponse.json({
      recentEarnings: earnings || [],
      totalCommission: parseFloat(totalCommission.toFixed(2)),
      totalOrders: totalOrders,
      avgPerOrder: parseFloat(avgCommissionPerOrder.toFixed(2)),
      commissionRate: earnings[0]?.commission_rate || 5.0
    })

  } catch (error) {
    console.error('Error fetching earnings:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
