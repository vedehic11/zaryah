import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { supabase as supabaseAdmin } from '@/lib/supabase'

export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    
    // 1. Authenticate Admin
    let authUser
    try {
      const authResult = await requireRole(request, 'Admin')
      authUser = authResult.user
      console.log('Admin authenticated for seller deletion:', authUser?.id)
    } catch (authError) {
      console.error('Auth error during seller deletion:', authError.message)
      return NextResponse.json(
        { error: authError.message || 'Unauthorized' },
        { status: authError.message === 'Forbidden: Insufficient permissions' ? 403 : 401 }
      )
    }

    if (!id) {
      return NextResponse.json({ error: 'Seller ID is required' }, { status: 400 })
    }

    console.log(`Starting administrative deletion of seller: ${id}`)

    // 2. Fetch the target seller's supabase_auth_id
    const { data: userRecord, error: userFetchError } = await supabaseAdmin
      .from('users')
      .select('supabase_auth_id')
      .eq('id', id)
      .maybeSingle()

    if (userFetchError) {
      console.error('Error fetching user for deletion:', userFetchError)
      return NextResponse.json({ error: 'Failed to fetch user record', details: userFetchError.message }, { status: 500 })
    }

    // 3. Fetch product IDs related to the seller
    const { data: products, error: productsFetchError } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('seller_id', id)

    if (productsFetchError) {
      console.error('Error fetching seller products:', productsFetchError)
      return NextResponse.json({ error: 'Failed to fetch seller products', details: productsFetchError.message }, { status: 500 })
    }

    const productIds = products ? products.map(p => p.id) : []
    console.log(`Seller has ${productIds.length} products to delete:`, productIds)

    // 4. Perform database deletions sequentially (to satisfy foreign keys)
    
    // Wishlist items referencing seller's products
    if (productIds.length > 0) {
      await supabaseAdmin.from('wishlist').delete().in('product_id', productIds)
      
      // Cart items referencing seller's products
      await supabaseAdmin.from('cart_items').delete().in('product_id', productIds)
      
      // Reviews referencing seller's products
      await supabaseAdmin.from('reviews').delete().in('product_id', productIds)
      
      // Product ratings referencing seller's products
      await supabaseAdmin.from('product_ratings').delete().in('product_id', productIds)
      
      // Order items referencing seller's products
      await supabaseAdmin.from('order_items').delete().in('product_id', productIds)
    }

    // Carts referencing seller
    await supabaseAdmin.from('carts').delete().eq('seller_id', id)

    // Admin earnings referencing seller
    await supabaseAdmin.from('admin_earnings').delete().eq('seller_id', id)

    // Transactions referencing seller
    await supabaseAdmin.from('transactions').delete().eq('seller_id', id)

    // Withdrawal requests referencing seller
    await supabaseAdmin.from('withdrawal_requests').delete().eq('seller_id', id)

    // Wallets referencing seller
    await supabaseAdmin.from('wallets').delete().eq('seller_id', id)

    // Seller reviews referencing seller
    await supabaseAdmin.from('seller_reviews').delete().eq('seller_id', id)

    // Seller sections referencing seller
    await supabaseAdmin.from('seller_sections').delete().eq('seller_id', id)

    // Support ticket messages and support messages matching seller tickets or product tickets
    let ticketQuery = supabaseAdmin.from('support_tickets').select('id')
    if (productIds.length > 0) {
      ticketQuery = ticketQuery.or(`seller_id.eq.${id},product_reference_id.in.(${productIds.join(',')})`)
    } else {
      ticketQuery = ticketQuery.eq('seller_id', id)
    }
    const { data: tickets } = await ticketQuery
    const ticketIds = tickets ? tickets.map(t => t.id) : []

    if (ticketIds.length > 0) {
      await supabaseAdmin.from('support_ticket_messages').delete().in('ticket_id', ticketIds)
      await supabaseAdmin.from('support_messages').delete().in('ticket_id', ticketIds)
      await supabaseAdmin.from('support_tickets').delete().in('id', ticketIds)
    }

    // Orders referencing seller
    await supabaseAdmin.from('orders').delete().eq('seller_id', id)

    // Email verifications referencing user
    await supabaseAdmin.from('email_verifications').delete().eq('user_id', id)

    // Addresses referencing user
    await supabaseAdmin.from('addresses').delete().eq('user_id', id)

    // Notifications referencing user
    await supabaseAdmin.from('notifications').delete().eq('user_id', id)

    // Products referencing seller
    await supabaseAdmin.from('products').delete().eq('seller_id', id)

    // Seller profile
    await supabaseAdmin.from('sellers').delete().eq('id', id)

    // User record
    const { error: userDeleteError } = await supabaseAdmin.from('users').delete().eq('id', id)
    if (userDeleteError) {
      console.error('Error deleting user record:', userDeleteError)
      return NextResponse.json({ error: 'Failed to delete user database record', details: userDeleteError.message }, { status: 500 })
    }

    // 5. Delete Supabase Auth User
    if (userRecord && userRecord.supabase_auth_id) {
      try {
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userRecord.supabase_auth_id)
        if (authDeleteError) {
          console.error('Failed to delete Supabase auth user:', authDeleteError)
        } else {
          console.log(`Deleted Supabase auth user: ${userRecord.supabase_auth_id}`)
        }
      } catch (authErr) {
        console.error('Unexpected error deleting Supabase auth user:', authErr)
      }
    }

    console.log(`Successfully completed administrative deletion of seller: ${id}`)
    return NextResponse.json({ success: true, message: 'Seller and all associated records deleted successfully' })

  } catch (error) {
    console.error('Unexpected error in DELETE /api/admin/sellers/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
