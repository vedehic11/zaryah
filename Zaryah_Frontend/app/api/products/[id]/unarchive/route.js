// Next.js API route to unarchive products
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// POST /api/products/[id]/unarchive - Unarchive/restore a product
export async function POST(request, { params }) {
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
      return NextResponse.json({ error: 'Forbidden: You can only unarchive your own products' }, { status: 403 })
    }

    // Unarchive the product
    const { data: unarchivedProduct, error } = await supabase
      .from('products')
      .update({
        archived: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error unarchiving product:', error)
      return NextResponse.json({ error: 'Unable to unarchive product' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Product restored successfully',
      product: unarchivedProduct
    })
  } catch (error) {
    console.error('Error unarchiving product:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
