// Next.js API route for admin product approval
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// POST /api/admin/products/[id]/approve - Approve product
export async function POST(request, { params }) {
  try {
    // Next.js 16: params is a Promise, unwrap it
    const { id } = await params
    const { user } = await requireRole(request, 'Admin')
    const body = await request.json()
    const { isApproved = true, rejectionReason } = body

    const updateData = {
      status: isApproved ? 'approved' : 'rejected',
      approved_by: isApproved ? user.id : null,
      rejected_by: !isApproved ? user.id : null,
      approved_at: isApproved ? new Date().toISOString() : null,
      rejected_at: !isApproved ? new Date().toISOString() : null,
      rejection_reason: rejectionReason || null,
      updated_at: new Date().toISOString()
    }

    const { data: product, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        sellers:seller_id (
          id,
          business_name,
          users:id (
            email
          )
        )
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // TODO: Send real-time notification to seller

    return NextResponse.json({
      success: true,
      message: isApproved ? 'Product approved successfully' : 'Product rejected',
      product
    })
  } catch (error) {
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: error.message === 'Unauthorized' ? 401 : 403 })
    }
    console.error('Error approving product:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


import { requireRole } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// POST /api/admin/products/[id]/approve - Approve product
export async function POST(request, { params }) {
  try {
    // Next.js 16: params is a Promise, unwrap it
    const { id } = await params
    const { user } = await requireRole(request, 'Admin')
    const body = await request.json()
    const { isApproved = true, rejectionReason } = body

    const updateData = {
      status: isApproved ? 'approved' : 'rejected',
      approved_by: isApproved ? user.id : null,
      rejected_by: !isApproved ? user.id : null,
      approved_at: isApproved ? new Date().toISOString() : null,
      rejected_at: !isApproved ? new Date().toISOString() : null,
      rejection_reason: rejectionReason || null,
      updated_at: new Date().toISOString()
    }

    const { data: product, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        sellers:seller_id (
          id,
          business_name,
          users:id (
            email
          )
        )
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // TODO: Send real-time notification to seller

    return NextResponse.json({
      success: true,
      message: isApproved ? 'Product approved successfully' : 'Product rejected',
      product
    })
  } catch (error) {
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: error.message === 'Unauthorized' ? 401 : 403 })
    }
    console.error('Error approving product:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}





