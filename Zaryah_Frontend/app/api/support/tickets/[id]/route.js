import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'

// PATCH /api/support/tickets/[id] - Update ticket (admin only)
export async function PATCH(request, { params }) {
  try {
    const session = await requireAuth(request)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserBySupabaseAuthId(session.user.id)
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Only admins can update tickets
    if (user.userType !== 'Admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const { status, priority, assigned_to, additional_info } = body

    const updateData = {}
    
    if (status) updateData.status = status
    if (priority) updateData.priority = priority
    if (assigned_to !== undefined) updateData.assigned_to = assigned_to
    if (additional_info !== undefined) updateData.additional_info = additional_info

    // If status is being set to resolved, set resolved_at and calculate resolution_time
    if (status === 'resolved') {
      updateData.resolved_at = new Date().toISOString()
      
      // Calculate resolution time in minutes
      const { data: ticketData } = await supabase
        .from('support_tickets')
        .select('created_at')
        .eq('id', id)
        .single()
      
      if (ticketData) {
        const createdAt = new Date(ticketData.created_at)
        const resolvedAt = new Date()
        const resolutionMinutes = Math.floor((resolvedAt - createdAt) / (1000 * 60))
        updateData.resolution_time = resolutionMinutes
      }
    }

    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .update(updateData)
      .eq('id', id)
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
      .single()

    if (error) {
      console.error('Error updating support ticket:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(ticket)
  } catch (error) {
    console.error('Error in support ticket update API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
