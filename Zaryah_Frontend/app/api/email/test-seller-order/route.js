import { NextResponse } from 'next/server'
import { requireAuth, getUserBySupabaseAuthId } from '@/lib/auth'
import { sendSellerOrderPlacedEmail } from '@/lib/email'

// POST /api/email/test-seller-order
export async function POST(request) {
  try {
    const session = await requireAuth(request)
    const user = await getUserBySupabaseAuthId(session.user.id)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const to = String(body?.to || '').trim()

    if (!to || !to.includes('@')) {
      return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 })
    }

    await sendSellerOrderPlacedEmail({
      to,
      sellerName: user?.name || user?.full_name || 'Seller',
      orderId: body?.orderId || 'test-order-0001',
      buyerName: body?.buyerName || 'Test Buyer',
      totalAmount: Number(body?.totalAmount || 999),
      items: Array.isArray(body?.items)
        ? body.items
        : [
            { name: 'Test Product A', quantity: 1, price: 499 },
            { name: 'Test Product B', quantity: 2, price: 250 }
          ]
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Unable to send test email' }, { status: 500 })
  }
}
