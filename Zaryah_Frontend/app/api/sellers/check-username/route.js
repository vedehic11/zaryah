import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/sellers/check-username?username=xxx - Check if username is available
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    // Validate username format
    const usernameRegex = /^[a-z0-9_-]+$/
    if (!usernameRegex.test(username)) {
      return NextResponse.json({ 
        available: false, 
        error: 'Invalid username format' 
      }, { status: 400 })
    }

    if (username.length < 3 || username.length > 50) {
      return NextResponse.json({ 
        available: false, 
        error: 'Username must be between 3 and 50 characters' 
      }, { status: 400 })
    }

    // Check if username exists in database
    const { data: existingUsername, error } = await supabase
      .from('sellers')
      .select('id')
      .eq('username', username.toLowerCase())
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking username:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // If existingUsername is null, username is available
    return NextResponse.json({ 
      available: !existingUsername,
      username: username.toLowerCase()
    })

  } catch (error) {
    console.error('Error in check-username:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
