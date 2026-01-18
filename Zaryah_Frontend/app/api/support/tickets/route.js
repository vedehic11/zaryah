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

    // For now, return empty array until support tickets table is created
    // TODO: Create support_tickets table in database
    return NextResponse.json([])

    // Future implementation:
    /*
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
        )
      `)
      .order('created_at', { ascending: false })

    // If seller, only show their tickets
    if (user.user_type === 'Seller') {
      query = query.eq('seller_id', user.id)
    }
    // Admin can see all tickets

    const { data: tickets, error } = await query

    if (error) {
      console.error('Error fetching support tickets:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(tickets || [])
    */
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
    const { subject, message, priority, related_order_id, related_product_id } = body

    if (!subject || !message) {
      return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 })
    }

    // For now, return success without creating ticket
    // TODO: Create support_tickets table and implement ticket creation
    return NextResponse.json({ 
      success: true, 
      message: 'Support tickets feature coming soon' 
    }, { status: 201 })

    // Future implementation:
    /*
    const ticketData = {
      user_id: user.id,
      subject,
      message,
      priority: priority || 'medium',
      status: 'open',
      related_order_id,
      related_product_id
    }

    // If related to seller's product/order, link seller
    if (related_product_id || related_order_id) {
      // Query to get seller_id from product or order
    }

    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert(ticketData)
      .select()
      .single()

    if (error) {
      console.error('Error creating support ticket:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(ticket, { status: 201 })
    */
  } catch (error) {
    console.error('Error in support tickets API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
