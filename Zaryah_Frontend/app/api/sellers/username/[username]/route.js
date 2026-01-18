import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/sellers/username/[username] - public seller profile + approved products
export async function GET(request, { params }) {
	try {
		const { username } = await params
		if (!username) {
			return NextResponse.json({ error: 'Username is required' }, { status: 400 })
		}

		// Fetch seller with linked user
		const { data: seller, error: sellerError } = await supabase
			.from('sellers')
			.select(`
				*,
				users:id (
					id,
					email,
					name,
					user_type,
					is_verified,
					is_approved,
					profile_photo
				)
			`)
			.eq('username', username.toLowerCase())
			.single()

		if (sellerError || !seller) {
			return NextResponse.json({ error: 'Seller not found' }, { status: 404 })
		}

		// Only expose approved sellers
		if (!seller.users?.is_approved || seller.users?.user_type !== 'Seller') {
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

		return NextResponse.json({
			...seller,
			products: productsWithRatings,
			stats
		})
	} catch (error) {
		console.error('Error fetching seller by username:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
