import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/sellers/username/[username] - public seller profile + approved products
export async function GET(request, { params }) {
	try {
		const { username } = await params
		console.log('=== GET /api/sellers/username/[username] START ===')
		console.log('Requested username:', username)
		
		if (!username) {
			return NextResponse.json({ error: 'Username is required' }, { status: 400 })
		}

		// Fetch seller - sellers.id IS the user id
		const { data: seller, error: sellerError } = await supabase
			.from('sellers')
			.select('*')
			.ilike('username', username)
			.single()

		console.log('Seller query result:', { found: !!seller, error: sellerError?.message })

		if (sellerError || !seller) {
			console.log('Seller not found in database')
			return NextResponse.json({ error: 'Seller not found' }, { status: 404 })
		}

		// Fetch the corresponding user record to check approval status
		const { data: user, error: userError } = await supabase
			.from('users')
			.select('id, email, name, user_type, is_verified, is_approved, profile_photo')
			.eq('id', seller.id)
			.single()

		console.log('User query result:', { found: !!user, error: userError?.message, approved: user?.is_approved })

		// Only expose approved sellers
		if (!user || !user.is_approved || user.user_type !== 'Seller') {
			console.log('Seller not approved or not a seller type')
			return NextResponse.json({ error: 'Seller not found' }, { status: 404 })
		}

		// Fetch seller products (only approved)
		const { data: products, error: productError } = await supabase
			.from('products')
			.select(`
				*,
				product_ratings (rating)
			`)
			.eq('seller_id', seller.id)
			.eq('status', 'approved')
			.order('created_at', { ascending: false })

		if (productError) {
			return NextResponse.json({ error: productError.message }, { status: 500 })
		}

		const productsWithRatings = (products || []).map((product) => {
			const ratings = product.product_ratings || []
			const avgRating = ratings.length > 0
				? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
				: 0

			return {
				id: product.id,
				name: product.name,
				description: product.description,
				price: parseFloat(product.price),
				images: product.images || [],
				video_url: product.video_url,
				category: product.category,
				section: product.section,
				weight: product.weight,
				stock: product.stock,
				customisable: product.customisable,
				custom_questions: product.custom_questions,
				features: product.features || [],
				delivery_time_min: product.delivery_time_min,
				delivery_time_max: product.delivery_time_max,
				delivery_time_unit: product.delivery_time_unit,
				instant_delivery: product.instant_delivery,
				instantDeliveryEligible: product.instant_delivery,
				status: product.status,
				createdAt: product.created_at,
				created_at: product.created_at,
				averageRating: parseFloat(avgRating),
				ratingCount: ratings.length,
				seller_id: product.seller_id,
				sellerId: product.seller_id,
				seller: {
					id: seller.id,
					business_name: seller.business_name,
					businessName: seller.business_name,
					sellerName: seller.business_name,
					username: seller.username
				}
			}
		})

		const stats = {
			productsCount: productsWithRatings.length,
			ordersCount: 0,
			averageRating: productsWithRatings.length > 0
				? (
						productsWithRatings.reduce((sum, p) => sum + (p.averageRating || 0), 0) /
						productsWithRatings.length
					).toFixed(1)
				: 0
		}

		// Combine seller and user data for response
		const responseData = {
			...seller,
			users: user, // Include user data
			products: productsWithRatings,
			stats
		}

		console.log('=== GET /api/sellers/username/[username] SUCCESS ===')
		return NextResponse.json(responseData)
	} catch (error) {
		console.error('=== GET /api/sellers/username/[username] ERROR ===')
		console.error('Error fetching seller by username:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
