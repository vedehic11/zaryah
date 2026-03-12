// Next.js API route for admin commission earnings
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

const SELLER_COMMISSION_RATE = 2.5

// GET /api/admin/earnings - Get platform commission earnings
export async function GET(request) {
  try {
    const { user } = await requireRole(request, 'Admin')

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'all' // all, today, week, month, year

    // Query orders directly with order_items
    let query = supabase
      .from('orders')
      .select(`
        id,
        seller_id,
        total_amount,
        platform_fee,
        delivery_fee,
        payment_method,
        payment_status,
        status,
        created_at,
        order_items (
          quantity,
          price
        ),
        sellers (
          business_name,
          full_name
        )
      `)
      .order('created_at', { ascending: false })

    // Filter by period
    const now = new Date()
    if (period === 'today') {
      const startOfDay = new Date(now.setHours(0, 0, 0, 0))
      query = query.gte('created_at', startOfDay.toISOString())
    } else if (period === 'week') {
      const startOfWeek = new Date(now.setDate(now.getDate() - 7))
      query = query.gte('created_at', startOfWeek.toISOString())
    } else if (period === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      query = query.gte('created_at', startOfMonth.toISOString())
    } else if (period === 'year') {
      const startOfYear = new Date(now.getFullYear(), 0, 1)
      query = query.gte('created_at', startOfYear.toISOString())
    }

    const { data: orders, error } = await query

    if (error) {
      console.error('Supabase error fetching orders:', error)
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }

    // Handle empty results
    if (!orders || orders.length === 0) {
      return NextResponse.json({
        recentEarnings: [],
        totalCommission: 0,
        totalPlatformFees: 0,
        totalDeliveryFees: 0,
        totalCODFees: 0,
        totalRevenue: 0,
        totalOrders: 0,
        avgPerOrder: 0,
        commissionRate: SELLER_COMMISSION_RATE
      })
    }

    console.log(`\n========== ADMIN EARNINGS CALCULATION (${period}) ==========`)
    console.log(`Total orders fetched: ${orders.length}`)

    // Include only monetized orders for earnings calculations:
    // - online orders only when paid
    // - all COD orders
    const eligibleOrders = orders.filter(order =>
      order.payment_method === 'cod' || order.payment_status === 'paid'
    )

    if (eligibleOrders.length === 0) {
      return NextResponse.json({
        recentEarnings: [],
        totalCommission: 0,
        totalPlatformFees: 0,
        totalDeliveryFees: 0,
        totalCODFees: 0,
        totalRevenue: 0,
        totalOrders: 0,
        paidOrders: 0,
        codPendingOrders: 0,
        avgPerOrder: 0,
        commissionRate: SELLER_COMMISSION_RATE
      })
    }

    console.log(`Eligible monetized orders: ${eligibleOrders.length}`)

    // Calculate earnings for each order
    const earnings = eligibleOrders.map(order => {
      // Calculate product subtotal
      const productSubtotal = order.order_items?.reduce((sum, item) => 
        sum + (item.quantity * item.price), 0
      ) || 0

        // Calculate commission (2.5% of product amount)
        const commission = parseFloat((productSubtotal * (SELLER_COMMISSION_RATE / 100)).toFixed(2))
      
      // Platform fee (₹10 or ₹20 from buyer)
      const platformFee = parseFloat(order.platform_fee || 0)
      
      // Delivery markup (only ₹10 markup goes to admin, rest to Shiprocket)
        // Delivery markup (only when delivery fee is charged)
        const deliveryMarkup = parseFloat(order.delivery_fee || 0) > 0 ? 10 : 0
      
      // COD fee (₹10 if payment method is COD, otherwise 0)
      const codFee = order.payment_method === 'cod' ? 10 : 0
      
      // Total admin revenue from this order
      const totalRevenue = commission + platformFee + deliveryMarkup + codFee

      console.log(`\nOrder #${order.id.slice(0, 8)} (${order.payment_method.toUpperCase()}, ${order.payment_status}):`)
      console.log(`  Product Amount: ₹${productSubtotal.toFixed(2)}`)
      console.log(`  Commission (2.5%): ₹${commission}`)
      console.log(`  Platform Fee: ₹${platformFee}`)
      console.log(`  Delivery Markup: ₹${deliveryMarkup}`)
      console.log(`  COD Fee: ₹${codFee}`)
      console.log(`  Total Admin Revenue: ₹${totalRevenue.toFixed(2)}`)

      return {
        id: order.id,
        order_id: order.id,
        seller_id: order.seller_id,
        sellers: order.sellers,
        commission_amount: commission,
        platform_fee: platformFee,
        delivery_fee: deliveryMarkup, // Only the ₹10 markup
        cod_fee: codFee,
        total_revenue: totalRevenue,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        order_status: order.status,
          earned_at: order.created_at,
        product_amount: productSubtotal
      }
    })

    // Calculate totals
    const totalCommission = earnings.reduce((sum, e) => sum + e.commission_amount, 0)
    const totalPlatformFees = earnings.reduce((sum, e) => sum + e.platform_fee, 0)
    const totalDeliveryFees = earnings.reduce((sum, e) => sum + e.delivery_fee, 0)
    const totalCODFees = earnings.reduce((sum, e) => sum + e.cod_fee, 0)
    const totalRevenue = totalCommission + totalPlatformFees + totalDeliveryFees + totalCODFees
    const totalOrders = earnings.length
    const avgPerOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0

    // Separate by payment status
    const paidOrders = earnings.filter(e => e.payment_status === 'paid')
    const codPendingOrders = earnings.filter(e => e.payment_method === 'cod' && e.payment_status === 'pending')

    console.log('\n========== SUMMARY ==========')
    console.log(`Total Commission: ₹${totalCommission.toFixed(2)}`)
    console.log(`Total Platform Fees: ₹${totalPlatformFees.toFixed(2)}`)
    console.log(`Total Delivery Fees: ₹${totalDeliveryFees.toFixed(2)}`)
    console.log(`Total COD Fees: ₹${totalCODFees.toFixed(2)}`)
    console.log(`Total Admin Revenue: ₹${totalRevenue.toFixed(2)}`)
    console.log(`Total Orders: ${totalOrders}`)
    console.log(`  - Paid: ${paidOrders.length}`)
    console.log(`  - COD Pending: ${codPendingOrders.length}`)
    console.log('================================\n')

    return NextResponse.json({
      recentEarnings: earnings,
      totalCommission: parseFloat(totalCommission.toFixed(2)),
      totalPlatformFees: parseFloat(totalPlatformFees.toFixed(2)),
      totalDeliveryFees: parseFloat(totalDeliveryFees.toFixed(2)),
      totalCODFees: parseFloat(totalCODFees.toFixed(2)),
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalOrders: totalOrders,
      paidOrders: paidOrders.length,
      codPendingOrders: codPendingOrders.length,
        avgPerOrder: parseFloat(avgPerOrder.toFixed(2)),
        commissionRate: SELLER_COMMISSION_RATE
    })

  } catch (error) {
    console.error('Error fetching earnings:', error)
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
