// Next.js API route for products
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth, checkUserRole } from '@/lib/auth'

// GET /api/products - Get all approved products (public) or all products (admin)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const status = searchParams.get('status')
    const sellerId = searchParams.get('sellerId')
    const adminView = searchParams.get('admin') === 'true'

    // Check if user is admin
    let isAdmin = false
    try {
      const session = await requireAuth(request)
      if (session?.user) {
        isAdmin = await checkUserRole(session.user.id, 'Admin')
      }
    } catch (authError) {
      // If auth fails, user is not admin (public access)
      // This is expected for public routes
    }

    let query = supabase
      .from('products')
      .select(`
        *,
        sellers:seller_id (
          id,
          business_name,
          full_name
        ),
        product_ratings (
          rating
        )
      `)

    // Apply filters
    if (category) {
      query = query.eq('category', category)
    }

    if (sellerId) {
      query = query.eq('seller_id', sellerId)
    }

    // Status filter: public sees only approved, admin can see all
    if (!isAdmin && !adminView) {
      query = query.eq('status', 'approved')
    } else if (status) {
      query = query.eq('status', status)
    }

    const { data: products, error } = await query.order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Calculate average ratings and format product data consistently
    const productsWithRatings = (products || []).map(product => {
      const ratings = product.product_ratings || []
      const avgRating = ratings.length > 0
        ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
        : 0

      // Format seller data for compatibility
      const seller = product.sellers || {}
      
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
          full_name: seller.full_name,
          businessName: seller.business_name,
          sellerName: seller.business_name
        }
      }
    })

    return NextResponse.json(productsWithRatings)
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/products - Create new product (seller/admin only)
export async function POST(request) {
  try {
    const { requireAuth, getUserBySupabaseAuthId } = await import('@/lib/auth')
    const session = await requireAuth(request)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserBySupabaseAuthId(session.user.id)
    if (!user || (user.user_type !== 'Seller' && user.user_type !== 'Admin')) {
      return NextResponse.json({ error: 'Forbidden: Only sellers can create products' }, { status: 403 })
    }

    const formData = await request.formData()
    const productData = {
      name: formData.get('name'),
      description: formData.get('description'),
      price: parseFloat(formData.get('price')),
      category: formData.get('category'),
      section: formData.get('section'),
      weight: parseFloat(formData.get('weight')),
      stock: parseInt(formData.get('stock')),
      customisable: formData.get('customisable') === 'true',
      delivery_time_min: parseInt(formData.get('deliveryTimeMin')),
      delivery_time_max: parseInt(formData.get('deliveryTimeMax')),
      delivery_time_unit: formData.get('deliveryTimeUnit') || 'days',
      instant_delivery: formData.get('instantDelivery') === 'true',
      seller_id: user.user_type === 'Seller' ? user.id : formData.get('sellerId'),
      status: 'pending'
    }

    const customQuestions = formData.get('customQuestions')
    if (customQuestions) {
      productData.custom_questions = JSON.parse(customQuestions)
    }

    const features = formData.get('features')
    if (features) {
      productData.features = JSON.parse(features)
    }

    const images = []
    const imageFiles = formData.getAll('images')
    productData.images = images

    const { data: product, error } = await supabase
      .from('products')
      .insert(productData)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

