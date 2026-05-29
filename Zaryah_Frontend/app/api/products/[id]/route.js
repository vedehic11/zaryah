// Next.js API route for individual product operations
import { NextResponse } from 'next/server'
// Use dynamic import for getSession
import { supabase } from '@/lib/supabase'

// GET /api/products/[id] - Get product by ID
export async function GET(request, { params }) {
  try {
    // Next.js 16: params is a Promise, unwrap it
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    // Basic UUID guard to avoid invalid queries
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: 'Invalid product id' }, { status: 400 })
    }

    console.log('Fetching product with ID:', id)

    const { data: product, error } = await supabase
      .from('products')
      .select(`
        *,
        sellers:seller_id (
          id,
          username,
          business_name,
          full_name,
          business_description,
          business_address,
          city,
          allow_cod
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Supabase error fetching product:', error)
      return NextResponse.json({ error: error.message || 'Product not found' }, { status: 404 })
    }

    if (!product) {
      console.error('Product not found for ID:', id)
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const { data: sellerReviews, error: sellerReviewError } = await supabase
      .from('seller_reviews')
      .select('rating')
      .eq('seller_id', product.seller_id)

    if (sellerReviewError) {
      console.error('Error fetching seller reviews:', sellerReviewError)
    }

    const sellerRatings = sellerReviews || []
    const avgRating = sellerRatings.length > 0
      ? (sellerRatings.reduce((sum, r) => sum + r.rating, 0) / sellerRatings.length).toFixed(1)
      : 0

    // Compute sellerRank (used as productRank)
    let sellerRank = 0
    try {
      const reviewsCount = sellerRatings.length
      const { count: salesCount, error: salesErr } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', product.seller_id)

      const sales = salesErr ? 0 : (salesCount || 0)

      const { data: lastOrder } = await supabase
        .from('orders')
        .select('created_at')
        .eq('seller_id', product.seller_id)
        .order('created_at', { ascending: false })

      const { data: lastProduct } = await supabase
        .from('products')
        .select('created_at')
        .eq('seller_id', product.seller_id)
        .order('created_at', { ascending: false })

      const lastDates = [seller.updated_at, lastOrder?.[0]?.created_at, lastProduct?.[0]?.created_at].filter(Boolean)
      const lastActivity = lastDates.length > 0 ? new Date(Math.max(...lastDates.map(d => new Date(d).getTime()))) : null
      const daysSince = lastActivity ? Math.floor((Date.now() - lastActivity.getTime()) / (1000*60*60*24)) : 365

      const ratingScore = (parseFloat(avgRating) / 5) * 100
      const salesScore = Math.min(100, (sales / 50) * 100)
      // Prefer clicks for engagement when available on product; fallback to seller review count
      const clicks = product.clicks || product.click_count || product.view_count || 0
      const engagementCount = clicks || reviewsCount || 0
      const engagementScore = Math.min(100, (engagementCount / 200) * 100)
      const recentScore = Math.max(0, 100 - daysSince)

      sellerRank = (0.4 * ratingScore) + (0.3 * salesScore) + (0.2 * engagementScore) + (0.1 * recentScore)
      sellerRank = Number(sellerRank.toFixed(2))
    } catch (err) {
      console.error('Error computing sellerRank for product detail:', err)
      sellerRank = 0
    }

    // Normalize categories and sections for backward compatibility
    const categories = Array.isArray(product.categories) ? product.categories : 
                      (product.category ? [product.category] : [])
    const sections = Array.isArray(product.sections) ? product.sections : 
                    (product.section ? [product.section] : [])

    // Format seller data
    const seller = product.sellers || {}
    
    console.log('Seller data from DB:', {
      id: seller.id,
      business_name: seller.business_name,
      username: seller.username,
      has_username: !!seller.username
    })

    // Return formatted product with all necessary fields
    return NextResponse.json({
      id: product.id,
      name: product.name,
      description: product.description,
      price: parseFloat(product.price),
      mrp: product.mrp ? parseFloat(product.mrp) : null,
      images: product.images || [],
      video_url: product.video_url,
      // Return both formats for compatibility
      categories: categories,
      category: categories[0] || null,
      sections: sections,
      section: sections[0] || null,
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
      instantDelivery: product.instant_delivery,
      instantDeliveryEligible: product.instant_delivery, // For compatibility
      size_options: product.size_options || [],
      sizeOptions: product.size_options || [],
      size_price_options: product.size_price_options || [],
      sizePriceOptions: product.size_price_options || [],
      material: product.material,
      care_instructions: product.care_instructions,
      careInstructions: product.care_instructions,
      return_available: product.return_available,
      returnAvailable: product.return_available,
      exchange_available: product.exchange_available,
      exchangeAvailable: product.exchange_available,
      return_days: product.return_days,
      returnDays: product.return_days,
      cod_available: product.cod_available,
      codAvailable: product.cod_available,
      two_way_delivery: product.two_way_delivery,
      twoWayDelivery: product.two_way_delivery,
      color_options: product.color_options || [],
      colorOptions: product.color_options || [],
      legal_disclaimer: product.legal_disclaimer,
      legalDisclaimer: product.legal_disclaimer,
      size_charts: product.size_charts || [],
      sizeCharts: product.size_charts || [],
      // Backward compatibility: if no size_charts, provide empty array (old size_chart_url is deprecated)
      size_chart_url: null,
      sizeChartUrl: null,
      is_genuine: product.is_genuine,
      isGenuine: product.is_genuine,
      is_quality_checked: product.is_quality_checked,
      isQualityChecked: product.is_quality_checked,
      status: product.status,
      createdAt: product.created_at,
      created_at: product.created_at,
      averageRating: parseFloat(avgRating),
      ratingCount: sellerRatings.length,
      productRank: sellerRank,
      // Seller information
      seller_id: product.seller_id,
      sellerId: product.seller_id, // For compatibility
      seller: {
        id: seller.id,
        business_name: seller.business_name,
        full_name: seller.full_name,
        business_description: seller.business_description,
        business_address: seller.business_address,
        username: seller.username,
        businessName: seller.business_name, // For compatibility
        sellerName: seller.business_name, // For compatibility
        businessDescription: seller.business_description,
        businessAddress: seller.business_address,
        city: seller.city,
        allowCod: seller.allow_cod !== false
        ,
        sellerRank: sellerRank
      },
      // Seller ratings are shown in the reviews tab via /api/reviews
    })
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/products/[id] - Update product (seller/admin only)
export async function PUT(request, { params }) {
  try {
    // Authenticate user
    const { requireAuth, getUserBySupabaseAuthId } = await import('@/lib/auth')
    const session = await requireAuth(request)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserBySupabaseAuthId(session.user.id)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Next.js 16: params is a Promise, unwrap it
    const { id } = await params

    // Check if user owns the product or is admin
    const { data: product } = await supabase
      .from('products')
      .select('seller_id')
      .eq('id', id)
      .single()

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Verify ownership or admin role
    if (user.user_type !== 'Admin' && product.seller_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You can only edit your own products' }, { status: 403 })
    }

    const body = await request.json()
    
    // Normalize delivery time unit if caller sent 'week'/'weeks'
    if (body && body.delivery_time_unit && String(body.delivery_time_unit).toLowerCase().startsWith('week')) {
      // Convert min/max from weeks to days
      if (body.delivery_time_min !== undefined && body.delivery_time_min !== null) {
        body.delivery_time_min = Number(body.delivery_time_min) * 7
      }
      if (body.delivery_time_max !== undefined && body.delivery_time_max !== null) {
        body.delivery_time_max = Number(body.delivery_time_max) * 7
      }
      body.delivery_time_unit = 'days'
    }
    
    // Handle categories - can be single value or array, normalize to array
    const updateBody = { ...body }
    if ('stock' in updateBody) {
      delete updateBody.stock
    }
    if (body.categories) {
      updateBody.categories = Array.isArray(body.categories) ? body.categories : [body.categories]
      updateBody.category = updateBody.categories[0] || null
    }
    if (body.sections) {
      updateBody.sections = Array.isArray(body.sections) ? body.sections : [body.sections]
      updateBody.section = updateBody.sections[0] || null
    }
    // For backward compatibility, also update single fields
    if (body.category) {
      updateBody.categories = [body.category]
      updateBody.category = body.category
    }
    if (body.section) {
      updateBody.sections = [body.section]
      updateBody.section = body.section
    }
    
    const { data: updatedProduct, error } = await supabase
      .from('products')
      .update({
        ...updateBody,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(updatedProduct)
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/products/[id] - Archive product (seller/admin only, soft delete)
export async function DELETE(request, { params }) {
  try {
    // Authenticate user
    const { requireAuth, getUserBySupabaseAuthId } = await import('@/lib/auth')
    const session = await requireAuth(request)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserBySupabaseAuthId(session.user.id)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Next.js 16: params is a Promise, unwrap it
    const { id } = await params

    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: 'Invalid product id' }, { status: 400 })
    }

    // Check if user owns the product or is admin
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('seller_id')
      .eq('id', id)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Verify ownership or admin role
    if (user.user_type !== 'Admin' && product.seller_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You can only delete your own products' }, { status: 403 })
    }

    // Archive the product (soft delete) instead of permanently deleting
    // This preserves order history and allows sellers to restore if needed
    const { data: archivedProduct, error } = await supabase
      .from('products')
      .update({
        archived: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error archiving product:', error)
      return NextResponse.json({ error: 'Unable to archive product' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Product archived successfully',
      product: archivedProduct
    })
  } catch (error) {
    console.error('Error archiving product:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function
async function getUserByAuth0Id(auth0Id) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth0_id', auth0Id)
    .single()

  if (error || !data) return null
  return data
}





