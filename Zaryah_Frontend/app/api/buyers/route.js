import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'

// POST /api/buyers - Create buyer record (for authenticated users or during registration)
export async function POST(request) {
  try {
    const body = await request.json()
    const { city, address, state, pincode, phone, userId } = body

    let userIdToUse = userId

    // If userId not provided in body, try to get from session
    if (!userIdToUse) {
      const session = await requireAuth(request)
      
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized - userId required or valid session' }, { status: 401 })
      }

      const user = await getUserBySupabaseAuthId(session.user.id)
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      userIdToUse = user.id
    }

    // Check if buyer record already exists
    const { data: existingBuyer } = await supabase
      .from('buyers')
      .select('id')
      .eq('id', userIdToUse)
      .maybeSingle()

    if (existingBuyer) {
      return NextResponse.json({ 
        success: true, 
        message: 'Buyer record already exists',
        buyer: existingBuyer 
      })
    }

    // Create buyer record using service role (bypasses RLS)
    const buyerRecord = {
      id: userIdToUse,
      city: city || 'Mumbai',
      address: address || '',
      state: state || '',
      pincode: pincode || '',
      phone: phone || ''
    }

    const { data: newBuyer, error: createError } = await supabase
      .from('buyers')
      .insert(buyerRecord)
      .select()
      .single()

    if (createError) {
      console.error('Error creating buyer record:', createError)
      return NextResponse.json({ 
        error: 'Failed to create buyer record',
        details: createError.message 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Buyer record created successfully',
      buyer: newBuyer 
    })
  } catch (error) {
    console.error('Buyer creation error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 })
  }
}
