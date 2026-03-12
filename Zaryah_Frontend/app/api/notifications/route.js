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

		const { data, error } = await supabase
			.from('notifications')
			.select('*')
			.eq('user_id', user.id)
			.eq('user_model', user.user_type)
			.order('created_at', { ascending: false })
			.limit(100)

		if (error) {
			return NextResponse.json({ error: error.message }, { status: 500 })
		}

		const notifications = (data || []).map((item) => ({
			...item,
			_id: item.id,
			isRead: Boolean(item.is_read)
		}))

		const unreadCount = notifications.filter((item) => !item.isRead).length

		return NextResponse.json({ notifications, unreadCount })
	} catch (error) {
		return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 })
	}
}

export async function PATCH(request) {
	try {
		const session = await requireAuth(request)
		const user = await getUserBySupabaseAuthId(session.user.id)

		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 })
		}

		const { error } = await supabase
			.from('notifications')
			.update({
				is_read: true,
				read_at: new Date().toISOString()
			})
			.eq('user_id', user.id)
			.eq('user_model', user.user_type)
			.eq('is_read', false)

		if (error) {
			return NextResponse.json({ error: error.message }, { status: 500 })
		}

		return NextResponse.json({ success: true })
	} catch (error) {
		return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 })
	}
}

export async function DELETE(request) {
	try {
		const session = await requireAuth(request)
		const user = await getUserBySupabaseAuthId(session.user.id)

		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 })
		}

		const { error } = await supabase
			.from('notifications')
			.delete()
			.eq('user_id', user.id)
			.eq('user_model', user.user_type)

		if (error) {
			return NextResponse.json({ error: error.message }, { status: 500 })
		}

		return NextResponse.json({ success: true })
	} catch (error) {
		return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 })
	}
}
