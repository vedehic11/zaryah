import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'

function applyUserModelFilter(query, userModelMatches) {
  if (userModelMatches.length === 0) {
    return query
  }

  if (typeof query.in === 'function') {
    return query.in('user_model', userModelMatches)
  }

  return query.eq('user_model', userModelMatches[0])
}

export async function GET(request) {
  try {
    const session = await requireAuth(request)
    const user = await getUserBySupabaseAuthId(session.user.id)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userModel = String(user.user_type || '').trim()
    const userModelMatches = Array.from(new Set([
      userModel,
      userModel.toLowerCase(),
      userModel.toUpperCase()
    ].filter(Boolean)))

    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    query = applyUserModelFilter(query, userModelMatches)

    query = query.eq('is_read', false)

    const { count, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ unreadCount: count || 0 })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 })
  }
}
