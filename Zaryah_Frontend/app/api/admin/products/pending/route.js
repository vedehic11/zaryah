import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// GET /api/admin/products/pending - list pending products for review
export async function GET(request) {
	try {
		await requireRole(request, 'Admin')

		const { data: products, error } = await supabase
			.from('products')
			.select(`
				*,
				sellers:seller_id (
					id,
					business_name,
					username
				)
			`)
			.eq('status', 'pending')
			.order('created_at', { ascending: false })

		if (error) {
			return NextResponse.json({ error: error.message }, { status: 500 })
		}

		return NextResponse.json(products || [])
	} catch (error) {
		const code = error.message === 'Unauthorized' ? 401 : 500
		return NextResponse.json({ error: error.message || 'Internal server error' }, { status: code })
	}
}
