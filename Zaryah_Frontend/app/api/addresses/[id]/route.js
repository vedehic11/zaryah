// Next.js API route for individual address operations
import { NextResponse } from 'next/server'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// GET /api/addresses/[id] - Get specific address
export async function GET(request, { params }) {
  try {
    const { id } = await params
    const { requireAuth: requireAuthHelper } = await import('@/lib/auth')
    const session = await requireAuthHelper(request)
    const user = await getUserBySupabaseAuthId(session.user.id)
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: address, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(address)
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching address:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/addresses/[id] - Update address
export async function PUT(request, { params }) {
  try {
    const { id } = await params
    const { requireAuth: requireAuthHelper } = await import('@/lib/auth')
    const session = await requireAuthHelper(request)
    const user = await getUserBySupabaseAuthId(session.user.id)
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify address belongs to user
    const { data: existingAddress } = await supabase
      .from('addresses')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existingAddress || existingAddress.user_id !== user.id) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, phone, address, city, state, pincode, country, isDefault } = body

    // If setting as default, unset other defaults
    if (isDefault) {
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .eq('is_default', true)
        .neq('id', id)
    }

    // Update address
    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (phone !== undefined) updateData.phone = phone
    if (address !== undefined) updateData.address = address
    if (city !== undefined) updateData.city = city
    if (state !== undefined) updateData.state = state
    if (pincode !== undefined) updateData.pincode = pincode
    if (country !== undefined) updateData.country = country
    if (isDefault !== undefined) updateData.is_default = isDefault

    const { data: updatedAddress, error } = await supabase
      .from('addresses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(updatedAddress)
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error updating address:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/addresses/[id] - Delete address
export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    const { requireAuth: requireAuthHelper } = await import('@/lib/auth')
    const session = await requireAuthHelper(request)
    const user = await getUserBySupabaseAuthId(session.user.id)
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify address belongs to user
    const { data: existingAddress } = await supabase
      .from('addresses')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existingAddress || existingAddress.user_id !== user.id) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error deleting address:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

