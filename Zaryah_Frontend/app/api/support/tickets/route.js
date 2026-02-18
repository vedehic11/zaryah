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
    if (user.user_type === 'Admin') {
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
    console.log('=== Support Ticket Creation Started ===')
    
    // Step 1: Authentication
    console.log('Step 1: Checking authentication...')
    const session = await requireAuth(request)
    
    if (!session?.user) {
      console.error('❌ Authentication failed - no session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('✅ Session found:', session.user.id)

    // Step 2: Get user details
    console.log('Step 2: Fetching user details...')
    const user = await getUserBySupabaseAuthId(session.user.id)
    
    if (!user) {
      console.error('❌ User not found for session:', session.user.id)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    console.log('✅ User found:', { id: user.id, email: user.email, type: user.user_type })

    // Step 3: Parse request body
    console.log('Step 3: Parsing request body...')
    const body = await request.json()
    console.log('Request body:', body)
    const { subject, message, priority, category, related_order_id, related_product_id } = body

    if (!subject || !message) {
      console.error('❌ Validation failed - missing subject or message')
      return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 })
    }
    console.log('✅ Validation passed')

    // Step 4: Generate ticket ID
    console.log('Step 4: Generating ticket ID...')
    const ticketId = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    console.log('✅ Generated ticket_id:', ticketId)

    // Step 5: Verify user exists in buyers or sellers table
    console.log('Step 5: Verifying user role...')
    const { data: buyerData } = await supabase
      .from('buyers')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()
    
    const { data: sellerData } = await supabase
      .from('sellers')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()
    
    if (!buyerData && !sellerData) {
      console.error('❌ User is neither buyer nor seller:', user.id)
      return NextResponse.json({ 
        error: 'User must be registered as buyer or seller to create tickets',
        user_id: user.id
      }, { status: 400 })
    }
    console.log('✅ User role verified:', buyerData ? 'buyer' : 'seller')

    // Step 6: Prepare ticket data
    console.log('Step 6: Preparing ticket data...')
    const ticketData = {
      ticket_id: ticketId,
      user_id: user.id,
      subject,
      description: message,
      priority: priority || 'medium',
      category: category || 'other',
      status: 'open'
    }

    // Add optional related IDs only if provided
    if (related_order_id) {
      console.log('Step 6a: Fetching seller from order:', related_order_id)
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('seller_id')
        .eq('id', related_order_id)
        .maybeSingle()
      
      if (orderError) {
        console.error('❌ Error fetching order:', orderError.message)
      } else if (order) {
        ticketData.seller_id = order.seller_id
        ticketData.order_reference_id = related_order_id
        console.log('✅ Added order reference and seller_id:', order.seller_id)
      } else {
        console.warn('⚠️ Order not found:', related_order_id)
      }
    }

    if (related_product_id) {
      console.log('Step 6b: Fetching seller from product:', related_product_id)
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('seller_id')
        .eq('id', related_product_id)
        .maybeSingle()
      
      if (productError) {
        console.error('❌ Error fetching product:', productError.message)
      } else if (product) {
        ticketData.seller_id = product.seller_id
        ticketData.product_reference_id = related_product_id
        console.log('✅ Added product reference and seller_id:', product.seller_id)
      } else {
        console.warn('⚠️ Product not found:', related_product_id)
      }
    }

    console.log('✅ Final ticket data:', JSON.stringify(ticketData, null, 2))
    
    // Step 7: Insert into database
    console.log('Step 7: Attempting database insert...')
    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert([ticketData])
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
      console.error('❌ DATABASE INSERT FAILED')
      console.error('Error code:', error.code)
      console.error('Error message:', error.message)
      console.error('Error details:', error.details)
      console.error('Error hint:', error.hint)
      console.error('Full error:', JSON.stringify(error, null, 2))
      
      return NextResponse.json({ 
        error: 'Database insert failed: ' + error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      }, { status: 400 })
    }

    console.log('✅ Ticket created successfully:', ticket.ticket_id)
    console.log('=== Support Ticket Creation Completed ===')
    return NextResponse.json(ticket, { status: 201 })
  } catch (error) {
    console.error('❌ UNEXPECTED ERROR IN CATCH BLOCK')
    console.error('Error name:', error.name)
    console.error('Error message:', error.message)
    console.error('Stack trace:', error.stack)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message,
      name: error.name
    }, { status: 500 })
  }
}
