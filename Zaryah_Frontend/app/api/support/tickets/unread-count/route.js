import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'

// GET /api/support/tickets/unread-count - Get unread messages count
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

    // Get tickets for this user
    let ticketQuery = supabase
      .from('support_tickets')
      .select('id')

    if (user.user_type === 'Admin') {
      // Admin sees all tickets - no filter
    } else {
      // Regular users see only their own tickets
      ticketQuery = ticketQuery.eq('user_id', user.id)
    }

    const { data: tickets, error: ticketsError } = await ticketQuery

    if (ticketsError) {
      console.error('Error fetching tickets:', ticketsError)
      return NextResponse.json({ error: ticketsError.message }, { status: 500 })
    }

    if (!tickets || tickets.length === 0) {
      return NextResponse.json({ unreadCount: 0, unreadByTicket: {} })
    }

    const ticketIds = tickets.map(t => t.id)

    // Get unread messages count
    // For admin: count messages where is_admin = false and is_read = false
    // For users: count messages where is_admin = true and is_read = false
    const { data: unreadMessages, error: messagesError } = await supabase
      .from('support_ticket_messages')
      .select('ticket_id')
      .in('ticket_id', ticketIds)
      .eq('is_read', false)
      .eq('is_admin', user.user_type === 'Admin' ? false : true)

    if (messagesError) {
      console.error('Error fetching unread messages:', messagesError)
      return NextResponse.json({ error: messagesError.message }, { status: 500 })
    }

    // Count unread messages per ticket
    const unreadByTicket = {}
    unreadMessages?.forEach(msg => {
      unreadByTicket[msg.ticket_id] = (unreadByTicket[msg.ticket_id] || 0) + 1
    })

    return NextResponse.json({
      unreadCount: unreadMessages?.length || 0,
      unreadByTicket
    })
  } catch (error) {
    console.error('Error in unread count API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
