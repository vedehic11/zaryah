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

    // Check if this is a dummy product ID (not a valid UUID)
    if (id.startsWith('dummy-') || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ 
        error: 'This is a demo product. Please use products from the database.' 
      }, { status: 404 })
    }

    console.log('Fetching product with ID:', id)

    const { data: product, error } = await supabase
      .from('products')
      .select(`
        *,
        sellers:seller_id (
          id,
          business_name,
          full_name,
          business_description
        ),
        product_ratings (
          id,
          user_id,
          rating,
          review,
          date,
          users:user_id (
            name,
            email
          )
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

    // Calculate average rating and format product data
    const ratings = product.product_ratings || []
    const avgRating = ratings.length > 0
      ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
      : 0

    // Format seller data
    const seller = product.sellers || {}

    // Return formatted product with all necessary fields
    return NextResponse.json({
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
      instantDeliveryEligible: product.instant_delivery, // For compatibility
      status: product.status,
      createdAt: product.created_at,
      created_at: product.created_at,
      averageRating: parseFloat(avgRating),
      ratingCount: ratings.length,
      // Seller information
      seller_id: product.seller_id,
      sellerId: product.seller_id, // For compatibility
      seller: {
        id: seller.id,
        business_name: seller.business_name,
        full_name: seller.full_name,
        business_description: seller.business_description,
        businessName: seller.business_name, // For compatibility
        sellerName: seller.business_name, // For compatibility
        city: seller.city
      },
      // Ratings with user info
      ratings: ratings.map(r => ({
        id: r.id,
        user_id: r.user_id,
        rating: r.rating,
        review: r.review,
        date: r.date,
        user: r.users || {}
      }))
    })
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/products/[id] - Update product (seller/admin only)
export async function PUT(request, { params }) {
  try {
    // TODO: Implement proper authentication
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

    const body = await request.json()
    const { data: updatedProduct, error } = await supabase
      .from('products')
      .update({
        ...body,
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

// DELETE /api/products/[id] - Delete product (seller/admin only)
export async function DELETE(request, { params }) {
  try {
    // TODO: Implement proper authentication
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

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Product deleted successfully' })
  } catch (error) {
    console.error('Error deleting product:', error)
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





