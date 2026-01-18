// Next.js API route for addresses
import { NextResponse } from 'next/server'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// GET /api/addresses - Get all addresses for authenticated user
export async function GET(request) {
  try {
    const { requireAuth: requireAuthHelper } = await import('@/lib/auth')
    const session = await requireAuthHelper(request)
    const user = await getUserBySupabaseAuthId(session.user.id)
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: addresses, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(addresses || [])
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching addresses:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/addresses - Create new address for authenticated user
export async function POST(request) {
  try {
    const { requireAuth: requireAuthHelper } = await import('@/lib/auth')
    const session = await requireAuthHelper(request)
    const user = await getUserBySupabaseAuthId(session.user.id)
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, phone, address, city, state, pincode, country = 'India', isDefault = false } = body

    // Validate required fields (phone is optional)
    if (!name || !address || !city || !pincode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // If this is set as default, unset other default addresses
    if (isDefault) {
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .eq('is_default', true)
    }

    // Create address
    const { data: newAddress, error } = await supabase
      .from('addresses')
      .insert({
        user_id: user.id,
        name,
        phone,
        address,
        city,
        state: state || '',
        pincode,
        country,
        is_default: isDefault,
        is_active: true
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(newAddress, { status: 201 })
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error creating address:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

