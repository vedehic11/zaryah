// Next.js API route for admin to approve/reject sellers
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// POST /api/admin/sellers/[id]/approve - Approve/reject seller
export async function POST(request, { params }) {
  try {
    console.log('\n=== SELLER APPROVAL REQUEST ===')
    
    // Next.js 16: params is a Promise, unwrap it
    const { id } = await params
    const { user } = await requireRole(request, 'Admin')
    const body = await request.json()
    const { isApproved = true } = body

    console.log('Seller ID:', id)
    console.log('Admin user:', user?.id)
    console.log('Action:', isApproved ? 'APPROVE' : 'REJECT')

    // Update users table
    const { data: updatedUser, error: userError } = await supabase
      .from('users')
      .update({
        is_approved: isApproved
      })
      .eq('id', id)
      .select()
      .single()

    if (userError) {
      console.log('User update error:', userError.message)
      return NextResponse.json({ error: userError.message }, { status: 400 })
    }

    console.log('User updated, is_approved:', updatedUser?.is_approved)

    // Update sellers table with approval details
    const { data: updatedSeller, error: sellerError } = await supabase
      .from('sellers')
      .update({
        approved_by: isApproved ? user.id : null,
        approved_at: isApproved ? new Date().toISOString() : null
      })
      .eq('id', id)
      .select(`
        *,
        users!sellers_id_fkey (
          email,
          name
        )
      `)
      .single()

    if (sellerError) {
      console.log('Seller update error:', sellerError.message)
      return NextResponse.json({ error: sellerError.message }, { status: 400 })
    }

    console.log('Seller updated, business_name:', updatedSeller?.business_name)

    // Send email notification to seller
    if (isApproved && updatedSeller) {
      try {
        // Call email service API
        const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/email/send-approval`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sellerEmail: updatedSeller.users.email,
            sellerName: updatedSeller.full_name,
            businessName: updatedSeller.business_name,
            username: updatedSeller.username || updatedSeller.business_name.toLowerCase().replace(/\s+/g, '-')
          })
        })

        const emailResult = await emailResponse.json()
        
        if (emailResult.success) {
          console.log('✅ Approval email sent successfully')
        } else {
          console.warn('⚠️ Email service returned error:', emailResult)
        }
        
      } catch (emailError) {
        console.error('❌ Error calling email service:', emailError)
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({
      success: true,
      message: isApproved ? 'Seller approved successfully and notification sent' : 'Seller approval removed',
      seller: updatedSeller
    })
  } catch (error) {
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      console.error('=== SELLER APPROVAL ERROR ===')
      console.error('Authorization error:', error.message)
      console.error('========================\n')
      return NextResponse.json({ error: error.message }, { status: error.message === 'Unauthorized' ? 401 : 403 })
    }
    console.error('=== SELLER APPROVAL ERROR ===')
    console.error('Error type:', error.name)
    console.error('Error message:', error.message)
    console.error('========================\n')
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 })
  }
}

