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
		const isArchivedColumnMissing = (error) => {
			const message = String(error?.message || error || '').toLowerCase()
			return message.includes('column products.archived does not exist') ||
				message.includes('could not find the') && message.includes('archived') ||
				message.includes('archived column')
		}

		const fetchSellerProducts = async (shouldSkipArchivedFilter) => {
			const { data, error } = await supabase
				.from('products')
				.select(`
					*,
					sellers:seller_id (id)
				`)
				.eq('seller_id', seller.id)
				.eq('status', 'approved')
				.order('created_at', { ascending: false })

			if (error) return { data: null, error }
			if (!shouldSkipArchivedFilter) {
				const filtered = (data || []).filter(p => !p.archived)
				return { data: filtered, error: null }
			}
			return { data, error: null }
		}

		let { data: products, error: productError } = await fetchSellerProducts(false)

		if (productError && isArchivedColumnMissing(productError)) {
			console.warn('Archived column is missing for seller profile, retrying without archived filter')
			;({ data: products, error: productError } = await fetchSellerProducts(true))
		}

		if (productError) {
			return NextResponse.json({ error: productError.message }, { status: 500 })
		}

		const { data: sellerReviews, error: sellerReviewError } = await supabase
			.from('seller_reviews')
			.select('rating')
			.eq('seller_id', seller.id)

		if (sellerReviewError) {
			console.error('Error fetching seller reviews:', sellerReviewError)
		}

		const sellerRatings = sellerReviews || []
		const avgRating = sellerRatings.length > 0
			? (sellerRatings.reduce((sum, r) => sum + r.rating, 0) / sellerRatings.length).toFixed(1)
			: 0

		const stats = {
			productsCount: 0,
			ordersCount: 0,
			averageRating: parseFloat(avgRating),
			ratingCount: sellerRatings.length
		}

		// Compute additional metrics for seller rank
		try {
			const reviewsCount = sellerRatings.length

			const { count: salesCount, error: salesErr } = await supabase
				.from('orders')
				.select('id', { count: 'exact', head: true })
				.eq('seller_id', seller.id)

			const sales = salesErr ? 0 : (salesCount || 0)

			// Recent activity
			const { data: lastOrder } = await supabase
				.from('orders')
				.select('created_at')
				.eq('seller_id', seller.id)
				.order('created_at', { ascending: false })

			const { data: lastProduct } = await supabase
				.from('products')
				.select('created_at')
				.eq('seller_id', seller.id)
				.order('created_at', { ascending: false })

			const lastDates = [seller.updated_at, lastOrder?.[0]?.created_at, lastProduct?.[0]?.created_at].filter(Boolean)
			const lastActivity = lastDates.length > 0 ? new Date(Math.max(...lastDates.map(d => new Date(d).getTime()))) : null
			const daysSince = lastActivity ? Math.floor((Date.now() - lastActivity.getTime()) / (1000*60*60*24)) : 365

			const ratingScore = (parseFloat(avgRating) / 5) * 100
			const salesScore = Math.min(100, (sales / 50) * 100)
			// Use seller clicks if available; fall back to reviews count
			const clicks = seller.clicks || seller.click_count || seller.view_count || 0
			const engagementCount = clicks || reviewsCount || 0
			const engagementScore = Math.min(100, (engagementCount / 200) * 100)
			const recentScore = Math.max(0, 100 - daysSince)

			const sellerRank = (0.4 * ratingScore) + (0.3 * salesScore) + (0.2 * engagementScore) + (0.1 * recentScore)

			// Attach to stats and seller
			stats.averageRating = parseFloat(avgRating)
			stats.ratingCount = reviewsCount
			stats.sellerRank = Number(sellerRank.toFixed(2))
			// add sellerRank to seller object as well
			seller.sellerRank = Number(sellerRank.toFixed(2))
		} catch (err) {
			console.error('Error computing seller rank:', err)
		}

		const productsWithRatings = (products || []).map((product) => {

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
				customQuestions: product.custom_questions,
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
				ratingCount: sellerRatings.length,
				productRank: seller.sellerRank || 0,
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

		stats.productsCount = productsWithRatings.length

		// Fetch seller sections with images
		const { data: sections, error: sectionsError } = await supabase
			.from('seller_sections')
			.select('id, name, image_url, created_at')
			.eq('seller_id', seller.id)
			.order('created_at', { ascending: true })

		const sellerSections = (sections || []).map(section => ({
			id: section.id,
			name: section.name,
			imageUrl: section.image_url,
			image_url: section.image_url
		}))

		// Combine seller and user data for response
		const responseData = {
			...seller,
			users: user, // Include user data
			products: productsWithRatings,
			sections: sellerSections,
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
