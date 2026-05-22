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
			.select('*')
			.eq('user_id', user.id)

		query = applyUserModelFilter(query, userModelMatches)

		query = query.order('created_at', { ascending: false }).limit(100)

		const { data, error } = await query

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

		const userModel = String(user.user_type || '').trim()
		const userModelMatches = Array.from(new Set([
			userModel,
			userModel.toLowerCase(),
			userModel.toUpperCase()
		].filter(Boolean)))

		let query = supabase
			.from('notifications')
			.update({
				is_read: true,
				read_at: new Date().toISOString()
			})
			.eq('user_id', user.id)

		query = applyUserModelFilter(query, userModelMatches)

		const { error } = await query.eq('is_read', false)

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

		const userModel = String(user.user_type || '').trim()
		const userModelMatches = Array.from(new Set([
			userModel,
			userModel.toLowerCase(),
			userModel.toUpperCase()
		].filter(Boolean)))

		let query = supabase
			.from('notifications')
			.delete()
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
