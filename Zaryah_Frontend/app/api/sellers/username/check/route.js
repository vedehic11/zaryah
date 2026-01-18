import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/sellers/username/check?username=foo
export async function GET(request) {
	const { searchParams } = new URL(request.url)
	const username = (searchParams.get('username') || '').toLowerCase().trim()

	const reserved = ['shop','product','login','register','admin','seller','orders','cart','support','gift-suggester','hamper-builder','api']
	const usernameRegex = /^[a-z0-9_-]+$/

	if (!username) {
		return NextResponse.json({ available: false, reason: 'missing' }, { status: 400 })
	}
	if (reserved.includes(username)) {
		return NextResponse.json({ available: false, reason: 'reserved' }, { status: 200 })
	}
	if (!usernameRegex.test(username) || username.length < 3 || username.length > 50) {
		return NextResponse.json({ available: false, reason: 'invalid' }, { status: 200 })
	}

	const { data: existing, error } = await supabase
		.from('sellers')
		.select('id')
		.eq('username', username)
		.maybeSingle()

	if (error) {
		return NextResponse.json({ available: false, reason: 'error', message: error.message }, { status: 500 })
	}

	return NextResponse.json({ available: !existing, reason: existing ? 'taken' : 'ok' })
}
