import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'

// GET /api/support/tickets/[id]/messages - Get messages for a ticket
export async function GET(request, { params }) {
  try {
    const session = await requireAuth(request)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserBySupabaseAuthId(session.user.id)
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { id } = await params // Await params in Next.js 15+

    // Get messages for this ticket
    const { data: messages, error } = await supabase
      .from('support_ticket_messages')
      .select(`
        *,
        sender:sender_id (
          id,
          name,
          email,
          user_type
        )
      `)
      .eq('ticket_id', id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching messages:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Mark messages as read
    // For admin: mark user messages as read
    // For users: mark admin messages as read
    const messagesToMarkRead = messages?.filter(msg => 
      user.user_type === 'Admin' ? !msg.is_admin && !msg.is_read : msg.is_admin && !msg.is_read
    ).map(msg => msg.id)

    if (messagesToMarkRead && messagesToMarkRead.length > 0) {
      await supabase
        .from('support_ticket_messages')
        .update({ is_read: true })
        .in('id', messagesToMarkRead)
    }

    return NextResponse.json(messages || [])
  } catch (error) {
    console.error('Error in messages API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/support/tickets/[id]/messages - Send a message
export async function POST(request, { params }) {
  try {
    const session = await requireAuth(request)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserBySupabaseAuthId(session.user.id)
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { id } = await params // Await params in Next.js 15+
    const body = await request.json()
    const { message } = body

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Verify ticket exists and user has access
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('id, user_id, seller_id')
      .eq('id', id)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Check access: Admin can send to any ticket, users can only send to their own tickets
    if (user.user_type !== 'Admin' && ticket.user_id !== user.id && ticket.seller_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Insert message
    const { data: newMessage, error: messageError } = await supabase
      .from('support_ticket_messages')
      .insert([{
        ticket_id: id,
        sender_id: user.id,
        message: message.trim(),
        is_admin: user.user_type === 'Admin'
      }])
      .select(`
        *,
        sender:sender_id (
          id,
          name,
          email,
          user_type
        )
      `)
      .single()

    if (messageError) {
      console.error('Error creating message:', messageError)
      return NextResponse.json({ error: messageError.message }, { status: 400 })
    }

    // Update ticket's updated_at timestamp
    await supabase
      .from('support_tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id)

    return NextResponse.json(newMessage, { status: 201 })
  } catch (error) {
    console.error('Error in messages API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
