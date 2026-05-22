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

export async function PATCH(request, { params }) {
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

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const read = body.read !== false

    const updates = read
      ? { is_read: true, read_at: new Date().toISOString() }
      : { is_read: false, read_at: null }

    let query = supabase
      .from('notifications')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)

    query = applyUserModelFilter(query, userModelMatches)

    const { error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 })
  }
}

export async function DELETE(request, { params }) {
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

    const { id } = await params

    let query = supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    query = applyUserModelFilter(query, userModelMatches)

    const { error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 })
  }
}
