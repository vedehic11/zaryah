import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { supabase as supabaseAdmin } from '@/lib/supabase'

// GET /api/admin/sellers - Get all sellers (admin only)
export async function GET(request) {
  try {
    const { session, user } = await requireRole(request, 'Admin')
    
    console.log('Admin sellers request - User:', user?.id, 'Type:', user?.user_type)

    // Fetch all sellers
    const { data: sellers, error: sellersError } = await supabaseAdmin
      .from('sellers')
      .select('*')
      .order('created_at', { ascending: false })

    console.log('Sellers query - Error:', sellersError, 'Count:', sellers?.length)

    if (sellersError) {
      console.error('Error fetching sellers:', sellersError)
      return NextResponse.json(
        { error: 'Failed to fetch sellers', details: sellersError.message },
        { status: 500 }
      )
    }

    if (!sellers || sellers.length === 0) {
      console.log('No sellers found in database')
      return NextResponse.json([], { status: 200 })
    }

    console.log('Found sellers:', sellers.map(s => ({ id: s.id, name: s.full_name })))

    // Fetch users data separately for each seller
    const sellerIds = sellers.map(s => s.id)
    const { data: usersData = [], error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, user_type, is_verified, is_approved, created_at, profile_photo')
      .in('id', sellerIds)

    console.log('Users query - Error:', usersError, 'Count:', usersData?.length)

    if (usersError) {
      console.error('Error fetching users:', usersError)
    }

    const usersMap = usersData.reduce((acc, u) => { acc[u.id] = u; return acc }, {})
    console.log('Users map:', Object.keys(usersMap).length, 'users')

    // Fetch product counts per seller
    const { data: productRows = [], error: productError } = await supabaseAdmin
      .from('products')
      .select('seller_id, status')

    console.log('Products query - Error:', productError, 'Count:', productRows?.length)

    const productCounts = productRows.reduce((acc, row) => {
      acc[row.seller_id] = acc[row.seller_id] || { total: 0, approved: 0, pending: 0 }
      acc[row.seller_id].total += 1
      if (row.status === 'approved') acc[row.seller_id].approved += 1
      if (row.status === 'pending') acc[row.seller_id].pending += 1
      return acc
    }, {})

    const shaped = sellers.map((s) => {
      const counts = productCounts[s.id] || { total: 0, approved: 0, pending: 0 }
      const userData = usersMap[s.id] || {}
      return {
        id: s.id,
        fullName: s.full_name,
        businessName: s.business_name,
        username: s.username,
        email: userData.email,
        isApproved: !!userData.is_approved,
        isVerified: !!userData.is_verified,
        registrationDate: s.created_at,
        businessDescription: s.business_description,
        story: s.story,
        featured_story: s.featured_story,
        city: s.city,
        primaryMobile: s.primary_mobile,
        idDocument: s.id_document,
        businessDocument: s.business_document,
        coverPhoto: s.cover_photo,
        stats: {
          products: counts.total,
          approvedProducts: counts.approved,
          pendingProducts: counts.pending,
          sales: 0
        },
        users: userData,
        raw: s
      }
    })

    console.log('Returning', shaped.length, 'sellers')
    return NextResponse.json(shaped, { status: 200 })

  } catch (error) {
    console.error('Error in GET /api/admin/sellers:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/sellers - Update seller properties (admin only)
export async function PATCH(request) {
  try {
    console.log('PATCH /api/admin/sellers - Starting')
    
    let session, user
    try {
      const result = await requireRole(request, 'Admin')
      session = result.session
      user = result.user
      console.log('Admin verified:', user?.id, user?.user_type)
    } catch (authError) {
      console.error('Auth error:', authError.message)
      return NextResponse.json(
        { error: authError.message || 'Unauthorized' }, 
        { status: authError.message === 'Forbidden: Insufficient permissions' ? 403 : 401 }
      )
    }
    
    const body = await request.json()
    console.log('Request body:', body)
    const { sellerId, ...updates } = body
    
    if (!sellerId) {
      console.error('No sellerId provided')
      return NextResponse.json({ error: 'Seller ID is required' }, { status: 400 })
    }
    
    // Only allow specific fields to be updated
    const allowedFields = ['featured_story', 'story']
    const filteredUpdates = {}
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field]
      }
    }
    
    console.log('Filtered updates:', filteredUpdates)
    
    if (Object.keys(filteredUpdates).length === 0) {
      console.error('No valid fields to update')
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }
    
    // Update seller in database
    console.log('Updating seller:', sellerId, 'with:', filteredUpdates)
    const { data, error } = await supabaseAdmin
      .from('sellers')
      .update(filteredUpdates)
      .eq('id', sellerId)
      .select()
      .single()
    
    if (error) {
      console.error('Supabase error updating seller:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    console.log('Successfully updated seller:', data)
    return NextResponse.json({ success: true, seller: data })
  } catch (error) {
    console.error('Unexpected error in PATCH /api/admin/sellers:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
