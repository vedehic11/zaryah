import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// GET /api/admin/sellers - Get all sellers (admin only)
export async function GET(request) {
  try {
    const { session, user } = await requireRole(request, 'Admin')
    
    console.log('Admin sellers request - User:', user?.id, 'Type:', user?.user_type)

    // Fetch all sellers
    const { data: sellers, error: sellersError } = await supabase
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
    const { data: usersData = [], error: usersError } = await supabase
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
    const { data: productRows = [], error: productError } = await supabase
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
