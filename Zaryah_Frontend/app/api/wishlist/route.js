import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'

// GET /api/wishlist - Get user's wishlist
export async function GET(request) {
  try {
    const session = await requireAuth(request)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserBySupabaseAuthId(session.user.id)
    
    if (!user) {
      console.error('User not found in database for supabase_auth_id:', session.user.id)
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 })
    }

    // Fetch wishlist items with product details
    const { data: wishlistItems, error } = await supabase
      .from('wishlist')
      .select(`
        id,
        product_id,
        created_at,
        products (
          id,
          name,
          description,
          price,
          mrp,
          images,
          category,
          section,
          stock,
          customisable,
          instant_delivery,
          seller_id,
          sellers (
            id,
            business_name,
            city
          )
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching wishlist:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform data to match expected format
    const items = wishlistItems.map(item => ({
      id: item.id,
      product_id: item.product_id,
      created_at: item.created_at,
      product: {
        ...item.products,
        seller: item.products.sellers
      }
    }))

    return NextResponse.json(items)
  } catch (error) {
    console.error('Error in wishlist GET API:', error)
    // If it's an auth error, return 401
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}

// POST /api/wishlist - Add product to wishlist
export async function POST(request) {
  try {
    const session = await requireAuth(request)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserBySupabaseAuthId(session.user.id)
    
    if (!user) {
      console.error('User not found in database for supabase_auth_id:', session.user.id)
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 })
    }

    const { product_id } = await request.json()

    if (!product_id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    // Check if already in wishlist
    const { data: existing } = await supabase
      .from('wishlist')
      .select('id')
      .eq('user_id', user.id)
      .eq('product_id', product_id)
      .single()

    if (existing) {
      return NextResponse.json({ message: 'Already in wishlist', exists: true })
    }

    // Add to wishlist
    const { data: wishlistItem, error } = await supabase
      .from('wishlist')
      .insert({
        user_id: user.id,
        product_id
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding to wishlist:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Added to wishlist', data: wishlistItem })
  } catch (error) {
    console.error('Error in wishlist POST API:', error)
    // If it's an auth error, return 401
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}

// DELETE /api/wishlist - Remove product from wishlist
export async function DELETE(request) {
  try {
    const session = await requireAuth(request)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserBySupabaseAuthId(session.user.id)
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const product_id = searchParams.get('product_id')

    if (!product_id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('wishlist')
      .delete()
      .eq('user_id', user.id)
      .eq('product_id', product_id)

    if (error) {
      console.error('Error removing from wishlist:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Removed from wishlist' })
  } catch (error) {
    console.error('Error in wishlist DELETE API:', error)
    // If it's an auth error, return 401
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}
