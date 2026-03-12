import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'

export async function GET(request) {
  try {
    const session = await requireAuth(request)
    const user = await getUserBySupabaseAuthId(session.user.id)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('user_model', user.user_type)
      .eq('is_read', false)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ unreadCount: count || 0 })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 })
  }
}
