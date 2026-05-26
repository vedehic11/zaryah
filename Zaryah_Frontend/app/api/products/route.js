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

    const includeArchived = searchParams.get('includeArchived') === 'true'
    const isArchivedColumnMissing = (error) => {
      const message = String(error?.message || error || '').toLowerCase()
      return message.includes('column products.archived does not exist') ||
        message.includes('could not find the') && message.includes('archived') ||
        message.includes('archived column')
    }

    const fetchProducts = async (shouldSkipArchivedFilter) => {
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
            business_description,
            allow_cod
          ),
          product_ratings (
            rating
          )
        `)

      // Apply filters
      // Note: category filter works with both single category strings and category arrays
      // We fetch all and filter in memory if categories is an array
      if (sellerId) {
        query = query.eq('seller_id', sellerId)
      }

      // Exclude archived products from public listings unless explicitly requested
      if (!shouldSkipArchivedFilter && !includeArchived) {
        query = query.eq('archived', false)
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
      return query.order('created_at', { ascending: false })
    }

    let { data: products, error } = await fetchProducts(false)

    if (error && !includeArchived && isArchivedColumnMissing(error)) {
      console.warn('Archived column is missing in the database, retrying without archived filter')
      ;({ data: products, error } = await fetchProducts(true))
    }

    // Filter by category if specified (handles both single and array categories)
    if (category && products) {
      products = products.filter(product => {
        const cats = Array.isArray(product.categories) ? product.categories : 
                     (product.category ? [product.category] : [])
        return cats.includes(category)
      })
    }

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
      
      // Normalize categories and sections for backward compatibility
      const categories = Array.isArray(product.categories) ? product.categories : 
                        (product.category ? [product.category] : [])
      const sections = Array.isArray(product.sections) ? product.sections : 
                      (product.section ? [product.section] : [])
      
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        price: parseFloat(product.price),
        archived: Boolean(product.archived),
        images: product.images || [],
        video_url: product.video_url,
        // Return both formats for compatibility
        categories: categories,
        category: categories[0] || null, // Primary category for backward compatibility
        sections: sections,
        section: sections[0] || null, // Primary section for backward compatibility
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
        size_price_options: product.size_price_options || [],
        sizePriceOptions: product.size_price_options || [],
        material: product.material,
        care_instructions: product.care_instructions,
        return_available: product.return_available,
        return_days: product.return_days,
        cod_available: product.cod_available,
        two_way_delivery: product.two_way_delivery,
        twoWayDelivery: product.two_way_delivery,
        color_options: product.color_options || [],
        colorOptions: product.color_options || [],
        legal_disclaimer: product.legal_disclaimer,
        size_charts: product.size_charts || [],
        sizeCharts: product.size_charts || [],
        // Backward compatibility
        size_chart_url: null,
        sizeChartUrl: null,
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
          businessDescription: seller.business_description,
          allowCod: seller.allow_cod !== false
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
    console.log('Environment check:', {
      hasCloudinaryName: !!process.env.CLOUDINARY_CLOUD_NAME,
      hasCloudinaryKey: !!process.env.CLOUDINARY_API_KEY,
      hasCloudinarySecret: !!process.env.CLOUDINARY_API_SECRET,
      nodeEnv: process.env.NODE_ENV
    })
    
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
    // Handle categories - can be single value or array
    let categories = []
    const categoriesParam = formData.get('categories')
    if (categoriesParam) {
      try {
        categories = JSON.parse(categoriesParam)
        if (!Array.isArray(categories)) categories = [categories]
      } catch (e) {
        categories = [categoriesParam]
      }
    } else {
      const singleCategory = formData.get('category')
      if (singleCategory) categories = [singleCategory]
    }

    // Handle sections - can be single value or array
    let sections = []
    const sectionsParam = formData.get('sections')
    if (sectionsParam) {
      try {
        sections = JSON.parse(sectionsParam)
        if (!Array.isArray(sections)) sections = [sections]
      } catch (e) {
        sections = [sectionsParam]
      }
    } else {
      const singleSection = formData.get('section')
      if (singleSection) sections = [singleSection]
    }

    // Normalize delivery time unit: accept 'week'/'weeks' by converting to days
    let deliveryTimeMin = parseInt(formData.get('deliveryTimeMin'))
    let deliveryTimeMax = parseInt(formData.get('deliveryTimeMax'))
    let deliveryTimeUnit = formData.get('deliveryTimeUnit') || 'days'
    if (String(deliveryTimeUnit).toLowerCase().startsWith('week')) {
      deliveryTimeMin = Number.isNaN(deliveryTimeMin) ? 0 : deliveryTimeMin * 7
      deliveryTimeMax = Number.isNaN(deliveryTimeMax) ? 0 : deliveryTimeMax * 7
      deliveryTimeUnit = 'days'
    }

    const INFINITE_STOCK = 999999
    const parsedStock = parseInt(formData.get('stock'))
    const stockValue = Number.isFinite(parsedStock) ? parsedStock : INFINITE_STOCK
    const productData = {
      name: formData.get('name'),
      description: formData.get('description'),
      price: parseFloat(formData.get('price')),
      mrp: formData.get('mrp') ? parseFloat(formData.get('mrp')) : null,
      categories: categories,
      category: categories[0] || null,
      sections: sections,
      section: sections[0] || null,
      weight: parseFloat(formData.get('weight')),
      stock: stockValue,
      customisable: formData.get('customisable') === 'true',
      delivery_time_min: deliveryTimeMin,
      delivery_time_max: deliveryTimeMax,
      delivery_time_unit: deliveryTimeUnit,
      instant_delivery: formData.get('instantDelivery') === 'true',
      material: formData.get('material') || null,
      care_instructions: formData.get('careInstructions') || null,
      return_available: formData.get('returnAvailable') === 'true',
      exchange_available: formData.get('exchangeAvailable') === 'true',
      return_days: formData.get('returnDays') ? parseInt(formData.get('returnDays')) : 0,
      cod_available: formData.get('codAvailable') === 'true',
      two_way_delivery: formData.get('twoWayDelivery') === 'true',
      legal_disclaimer: formData.get('legalDisclaimer') || null,
      size_charts: [],
      seller_id: user.user_type === 'Seller' ? user.id : formData.get('sellerId'),
      status: 'approved'
    }

    // Handle size_charts (new format) or fallback to size_chart_url (old format)
    const sizeChartsStr = formData.get('sizeCharts')
    if (sizeChartsStr) {
      try {
        const parsed = JSON.parse(sizeChartsStr)
        if (Array.isArray(parsed)) {
          productData.size_charts = parsed.filter(chart => chart.label && (chart.urls?.length > 0 || chart.url))
        }
      } catch (parseError) {
        console.warn('Failed to parse sizeCharts:', parseError)
      }
    }
    
    // Fallback: if no size_charts, check for old size_chart_url format
    if (productData.size_charts.length === 0) {
      const oldSizeChartUrl = formData.get('sizeChartUrl')
      if (oldSizeChartUrl) {
        productData.size_charts = [{ label: 'Size Chart', urls: [oldSizeChartUrl] }]
      }
    }

    // Handle size_options
    const sizeOptionsStr = formData.get('sizeOptions')
    if (sizeOptionsStr && sizeOptionsStr.trim()) {
      productData.size_options = sizeOptionsStr.split(',').map(s => s.trim()).filter(s => s)
    }

    const sizePriceOptionsStr = formData.get('sizePriceOptions')
    if (sizePriceOptionsStr) {
      try {
        const parsed = JSON.parse(sizePriceOptionsStr)
        if (Array.isArray(parsed)) {
          productData.size_price_options = parsed
          if (!productData.size_options || productData.size_options.length === 0) {
            productData.size_options = parsed
              .map(option => String(option?.label || '').trim())
              .filter(Boolean)
          }
        }
      } catch (parseError) {
        console.warn('Failed to parse sizePriceOptions:', parseError)
      }
    }

    const colorOptionsStr = formData.get('colorOptions')
    if (colorOptionsStr) {
      try {
        const parsed = JSON.parse(colorOptionsStr)
        if (Array.isArray(parsed)) {
          productData.color_options = parsed
        }
      } catch (parseError) {
        console.warn('Failed to parse colorOptions:', parseError)
      }
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
    const importedImagesStr = formData.get('importedImages')
    let importedImages = []
    if (importedImagesStr) {
      try {
        const parsed = JSON.parse(importedImagesStr)
        if (Array.isArray(parsed)) {
          importedImages = parsed.filter(image => typeof image === 'string' && image.trim())
        }
      } catch (parseError) {
        console.warn('Failed to parse importedImages:', parseError)
      }
    }

    const imageFiles = formData.getAll('images').filter(imageFile => imageFile instanceof File && imageFile.size > 0)
    const uploadedImages = []
    
    if (imageFiles && imageFiles.length > 0) {
      console.log(`Processing ${imageFiles.length} image files...`)
      
      try {
        // Import Cloudinary uploader
        const cloudinary = require('cloudinary').v2
        
        // Configure Cloudinary
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
          console.error('❌ Cloudinary credentials not configured!')
          console.log('Skipping image upload - product will be created without images')
        } else {
          cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
          })
          
          // Upload with timeout protection
          const uploadPromises = imageFiles.map(async (imageFile, index) => {
            if (!(imageFile instanceof File) || imageFile.size === 0) {
              console.log(`Skipping invalid file at index ${index}`)
              return null
            }
            
            try {
              console.log(`📤 Uploading image ${index + 1}/${imageFiles.length}: ${imageFile.name} (${(imageFile.size / 1024).toFixed(2)} KB)`)
              
              const arrayBuffer = await imageFile.arrayBuffer()
              const buffer = Buffer.from(arrayBuffer)
              
              // Upload with 30 second timeout
              const uploadWithTimeout = () => new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                  reject(new Error('Upload timeout (30s)'))
                }, 30000)
                
                const uploadStream = cloudinary.uploader.upload_stream(
                  {
                    folder: 'products',
                    resource_type: 'auto',
                    timeout: 60000
                  },
                  (error, result) => {
                    clearTimeout(timeout)
                    if (error) {
                      console.error(`❌ Cloudinary error for ${imageFile.name}:`, error)
                      reject(error)
                    } else {
                      resolve(result)
                    }
                  }
                )
                uploadStream.end(buffer)
              })
              
              const result = await uploadWithTimeout()
              console.log(`✅ Image ${index + 1} uploaded: ${result.secure_url}`)
              return result.secure_url
            } catch (uploadError) {
              console.error(`❌ Failed to upload image ${index + 1} (${imageFile.name}):`, uploadError.message)
              return null
            }
          })
          
          // Wait for all uploads with overall timeout
          const uploadResults = await Promise.race([
            Promise.allSettled(uploadPromises),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Overall upload timeout (2 minutes)')), 120000))
          ]).catch(error => {
            console.error('⏱️ Overall upload timeout:', error.message)
            return []
          })
          
          // Collect successful uploads
          if (Array.isArray(uploadResults)) {
            uploadResults.forEach((result, index) => {
              if (result.status === 'fulfilled' && result.value) {
                uploadedImages.push(result.value)
              }
            })
          }
        }
      } catch (cloudinaryError) {
        console.error('❌ Cloudinary initialization error:', cloudinaryError)
        console.log('⚠️ Continuing without images...')
      }
      
      console.log(`✅ Successfully uploaded ${uploadedImages.length}/${imageFiles.length} images`)
    }
    
    productData.images = [...importedImages, ...uploadedImages]
    
    if (imageFiles && imageFiles.length > 0 && uploadedImages.length === 0) {
      console.warn('⚠️ WARNING: All image uploads failed, creating product without images')
    }

    console.log('Inserting product into database...', {
      name: productData.name,
      seller_id: productData.seller_id,
      images_count: productData.images.length
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

