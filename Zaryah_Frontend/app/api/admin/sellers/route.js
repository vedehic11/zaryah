import { NextResponse } from 'next/server'
import { supabaseClient } from '@/lib/supabase-client'

// GET /api/admin/sellers - Get all sellers (admin only)
export async function GET(request) {
  try {
    // Get the authorization token from the request header
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      )
    }

    // Verify the user is authenticated and is an admin
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      )
    }

    // Check if user is an admin
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('user_type')
      .eq('supabase_auth_id', user.id)
      .single()

    if (userError || userData?.user_type !== 'Admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    // Fetch all sellers with their user data
    // Use !sellers_id_fkey to specify the relationship (sellers.id = users.id)
    const { data: sellers, error: sellersError } = await supabaseClient
      .from('sellers')
      .select(`
        *,
        users!sellers_id_fkey (
          id,
          email,
          name,
          user_type,
          is_verified,
          is_approved,
          created_at
        )
      `)
      .order('created_at', { ascending: false })

    if (sellersError) {
      console.error('Error fetching sellers:', sellersError)
      return NextResponse.json(
        { error: 'Failed to fetch sellers', details: sellersError.message },
        { status: 500 }
      )
    }

    return NextResponse.json(sellers || [], { status: 200 })

  } catch (error) {
    console.error('Error in GET /api/admin/sellers:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
