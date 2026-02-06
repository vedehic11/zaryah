// Next.js API route for products
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth, checkUserRole } from '@/lib/auth'

// GET /api/products - Get all approved products (public) or all products (admin)
export async function GET(request) {
  try {
    console.log('=== GET /api/products START ===')
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const status = searchParams.get('status')
    const sellerId = searchParams.get('sellerId')
    const adminView = searchParams.get('admin') === 'true'

    console.log('Query params:', { category, status, sellerId, adminView })

    // Check if user is admin
    let isAdmin = false
    try {
      const session = await requireAuth(request)
      if (session?.user) {
        isAdmin = await checkUserRole(session.user.id, 'Admin')
        console.log('User authenticated, isAdmin:', isAdmin)
      }
    } catch (authError) {
      // If auth fails, user is not admin (public access)
      // This is expected for public routes
      console.log('No authentication (public access)')
    }

    let query = supabase
      .from('products')
      .select(`
        *,
        sellers:seller_id (
          id,
          business_name,
          full_name,
          username,
          city,
          business_address,
          business_description
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

    // Status filter: default to showing approved for public, but allow explicit status filter
    if (status) {
      query = query.eq('status', status)
      console.log('Filtering by status:', status)
    } else if (!isAdmin) {
      // Public users only see approved products
      query = query.eq('status', 'approved')
      console.log('Public user - filtering for approved products only')
    }

    console.log('Executing Supabase query...')
    const { data: products, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('Products fetched:', products?.length || 0)

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
        mrp: product.mrp ? parseFloat(product.mrp) : null,
        size_options: product.size_options || [],
        material: product.material,
        care_instructions: product.care_instructions,
        return_available: product.return_available,
        return_days: product.return_days,
        cod_available: product.cod_available,
        legal_disclaimer: product.legal_disclaimer,
        is_genuine: product.is_genuine,
        is_quality_checked: product.is_quality_checked,
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
          sellerName: seller.business_name,
          username: seller.username,
          city: seller.city,
          businessAddress: seller.business_address,
          businessDescription: seller.business_description
        }
      }
    })

    console.log('=== GET /api/products SUCCESS ===')
    return NextResponse.json(productsWithRatings)
  } catch (error) {
    console.error('=== GET /api/products ERROR ===')
    console.error('Error fetching products:', error)
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}

// POST /api/products - Create new product (seller/admin only)
export async function POST(request) {
  try {
    console.log('=== CREATE PRODUCT START ===')
    
    const { requireAuth, getUserBySupabaseAuthId } = await import('@/lib/auth')
    const session = await requireAuth(request)
    
    if (!session?.user) {
      console.log('No session user found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserBySupabaseAuthId(session.user.id)
    console.log('User:', { id: user?.id, type: user?.user_type, approved: user?.is_approved })
    
    if (!user || (user.user_type !== 'Seller' && user.user_type !== 'Admin')) {
      console.log('User is not a seller or admin')
      return NextResponse.json({ error: 'Forbidden: Only sellers can create products' }, { status: 403 })
    }

    if (user.user_type === 'Seller' && !user.is_approved) {
      console.log('Seller not approved yet')
      return NextResponse.json({ error: 'Seller not approved yet' }, { status: 403 })
    }

    const formData = await request.formData()
    console.log('Form data keys:', Array.from(formData.keys()))
    const productData = {
      name: formData.get('name'),
      description: formData.get('description'),
      price: parseFloat(formData.get('price')),
      mrp: formData.get('mrp') ? parseFloat(formData.get('mrp')) : null,
      category: formData.get('category'),
      section: formData.get('section'),
      weight: parseFloat(formData.get('weight')),
      stock: parseInt(formData.get('stock')),
      customisable: formData.get('customisable') === 'true',
      delivery_time_min: parseInt(formData.get('deliveryTimeMin')),
      delivery_time_max: parseInt(formData.get('deliveryTimeMax')),
      delivery_time_unit: formData.get('deliveryTimeUnit') || 'days',
      instant_delivery: formData.get('instantDelivery') === 'true',
      material: formData.get('material') || null,
      care_instructions: formData.get('careInstructions') || null,
      return_available: formData.get('returnAvailable') === 'true',
      exchange_available: formData.get('exchangeAvailable') === 'true',
      return_days: formData.get('returnDays') ? parseInt(formData.get('returnDays')) : 0,
      cod_available: formData.get('codAvailable') === 'true',
      legal_disclaimer: formData.get('legalDisclaimer') || null,
      seller_id: user.user_type === 'Seller' ? user.id : formData.get('sellerId'),
      status: 'approved'
    }

    // Handle size_options
    const sizeOptionsStr = formData.get('sizeOptions')
    if (sizeOptionsStr && sizeOptionsStr.trim()) {
      productData.size_options = sizeOptionsStr.split(',').map(s => s.trim()).filter(s => s)
    }

    if (!productData.seller_id) {
      return NextResponse.json({ error: 'Seller id is required' }, { status: 400 })
    }

    // If admin is creating on behalf of a seller, ensure seller exists and is approved
    if (user.user_type === 'Admin' && productData.seller_id) {
      const { data: sellerRecord, error: sellerCheckError } = await supabase
        .from('sellers')
        .select('id')
        .eq('id', productData.seller_id)
        .single()

      if (sellerCheckError || !sellerRecord) {
        return NextResponse.json({ error: 'Invalid seller id' }, { status: 400 })
      }
    }

    const customQuestions = formData.get('customQuestions')
    if (customQuestions) {
      productData.custom_questions = JSON.parse(customQuestions)
    }

    const features = formData.get('features')
    if (features) {
      productData.features = JSON.parse(features)
    }

    // Handle image uploads directly to Cloudinary
    const imageFiles = formData.getAll('images')
    const images = []
    
    if (imageFiles && imageFiles.length > 0) {
      console.log(`Processing ${imageFiles.length} image files...`)
      
      try {
        // Import Cloudinary uploader
        const cloudinary = require('cloudinary').v2
        
        // Configure Cloudinary
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
          console.warn('Cloudinary credentials not configured, skipping image upload')
        } else {
          cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
          })
          
          for (const imageFile of imageFiles) {
            if (imageFile instanceof File && imageFile.size > 0) {
              try {
                console.log(`Uploading image: ${imageFile.name}, size: ${imageFile.size}`)
                
                const arrayBuffer = await imageFile.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)
                
                // Upload to Cloudinary using promise
                const result = await new Promise((resolve, reject) => {
                  const uploadStream = cloudinary.uploader.upload_stream(
                    {
                      folder: 'products',
                      resource_type: 'auto'
                    },
                    (error, result) => {
                      if (error) {
                        console.error('Cloudinary upload error:', error)
                        reject(error)
                      } else {
                        resolve(result)
                      }
                    }
                  )
                  uploadStream.end(buffer)
                })
                
                images.push(result.secure_url)
                console.log(`Image uploaded successfully: ${result.secure_url}`)
              } catch (uploadError) {
                console.error('Error uploading image:', imageFile.name, uploadError)
                // Continue with other images even if one fails
              }
            }
          }
        }
      } catch (cloudinaryError) {
        console.error('Cloudinary initialization error:', cloudinaryError)
        console.log('Continuing without images...')
      }
      
      console.log(`Successfully uploaded ${images.length} images`)
    }
    
    productData.images = images

    console.log('Inserting product into database...', {
      name: productData.name,
      seller_id: productData.seller_id,
      images_count: images.length
    })

    const { data: product, error } = await supabase
      .from('products')
      .insert(productData)
      .select()
      .single()

    if (error) {
      console.error('Product insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.log('Product created successfully:', product.id)
    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('=== ERROR CREATING PRODUCT ===')
    console.error('Error name:', error.name)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    console.error('================================')
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 })
  }
}

