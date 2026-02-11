import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'

// GET /api/support/tickets - Get support tickets for seller or all tickets for admin
export async function GET(request) {
  try {
    const session = await requireAuth(request)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserBySupabaseAuthId(session.user.id)
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Fetch support tickets based on user role
    let query = supabase
      .from('support_tickets')
      .select(`
        *,
        users:user_id (
          id,
          name,
          email
        ),
        sellers:seller_id (
          id,
          business_name
        ),
        orders:order_reference_id (
          id,
          status,
          total_amount
        ),
        products:product_reference_id (
          id,
          name,
          images
        )
      `)
      .order('created_at', { ascending: false })

    // Regular users see only their own tickets
    // Check if user is a buyer or seller
    const { data: buyerCheck } = await supabase
      .from('buyers')
      .select('id')
      .eq('id', user.id)
      .single()

    const { data: sellerCheck } = await supabase
      .from('sellers')
      .select('id')
      .eq('id', user.id)
      .single()

    // Admin sees all tickets
    if (user.userType === 'Admin') {
      // No filter - admin sees everything
    } else if (buyerCheck) {
      // Buyer sees their own tickets
      query = query.eq('user_id', user.id)
    } else if (sellerCheck) {
      // Seller sees tickets related to their products/orders
      query = query.or(`seller_id.eq.${user.id},user_id.eq.${user.id}`)
    }

    const { data: tickets, error } = await query

    if (error) {
      console.error('Error fetching support tickets:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(tickets || [])
  } catch (error) {
    console.error('Error in support tickets API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/support/tickets - Create new support ticket
export async function POST(request) {
  try {
    const session = await requireAuth(request)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserBySupabaseAuthId(session.user.id)
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { subject, message, priority, category, related_order_id, related_product_id } = body

    if (!subject || !message) {
      return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 })
    }

    // Generate unique ticket_id
    const ticketId = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

    // Prepare ticket data (matching existing schema)
    const ticketData = {
      ticket_id: ticketId,
      user_id: user.id,
      subject,
      description: message, // existing schema uses 'description' not 'message'
      priority: priority || 'medium',
      category: category || 'other',
      status: 'open',
      order_reference_id: related_order_id || null, // existing schema uses 'order_reference_id'
      product_reference_id: related_product_id || null // existing schema uses 'product_reference_id'
    }

    // If related to order or product, try to get seller_id
    if (related_order_id) {
      const { data: order } = await supabase
        .from('orders')
        .select('seller_id')
        .eq('id', related_order_id)
        .single()
      
      if (order) {
        ticketData.seller_id = order.seller_id
      }
    } else if (related_product_id) {
      const { data: product } = await supabase
        .from('products')
        .select('seller_id')
        .eq('id', related_product_id)
        .single()
      
      if (product) {
        ticketData.seller_id = product.seller_id
      }
    }

    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert(ticketData)
      .select(`
        *,
        users:user_id (
          id,
          name,
          email
        )
      `)
      .single()

    if (error) {
      console.error('Error creating support ticket:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(ticket, { status: 201 })
  } catch (error) {
    console.error('Error in support tickets API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
