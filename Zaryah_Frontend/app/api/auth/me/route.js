import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const authId = searchParams.get('authId')

    const authHeader = request.headers.get('authorization')
    let tokenAuthUser = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data: { user } } = await supabase.auth.getUser(token)
      if (user) {
        tokenAuthUser = user
      }
    }

    const queryEmail = email || tokenAuthUser?.email
    const queryAuthId = authId || tokenAuthUser?.id

    if (!queryEmail && !queryAuthId) {
      return NextResponse.json({ error: 'Email or Auth ID is required' }, { status: 400 })
    }

    console.log('GET /api/auth/me - Looking up user by:', { queryEmail, queryAuthId })

    // Query users table using service role client
    let query = supabase.from('users').select('*')
    if (queryAuthId && queryEmail) {
      query = query.or(`supabase_auth_id.eq.${queryAuthId},email.eq.${queryEmail}`)
    } else if (queryAuthId) {
      query = query.eq('supabase_auth_id', queryAuthId)
    } else {
      query = query.ilike('email', queryEmail)
    }

    const { data: user, error } = await query.maybeSingle()

    if (error) {
      console.error('Error fetching user in /api/auth/me:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!user && queryEmail) {
      // Secondary fallback case-insensitive email query
      const { data: fallbackUser } = await supabase
        .from('users')
        .select('*')
        .ilike('email', queryEmail)
        .maybeSingle()

      if (fallbackUser) {
        if (queryAuthId && !fallbackUser.supabase_auth_id) {
          await supabase.from('users').update({ supabase_auth_id: queryAuthId }).eq('id', fallbackUser.id)
          fallbackUser.supabase_auth_id = queryAuthId
        }
        return NextResponse.json({ user: fallbackUser })
      }
    }

    if (user) {
      // Ensure supabase_auth_id is linked
      if (queryAuthId && (!user.supabase_auth_id || user.supabase_auth_id !== queryAuthId)) {
        await supabase.from('users').update({ supabase_auth_id: queryAuthId }).eq('id', user.id)
        user.supabase_auth_id = queryAuthId
      }
      return NextResponse.json({ user })
    }

    return NextResponse.json({ user: null })
  } catch (err) {
    console.error('Unhandled error in /api/auth/me:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
