import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { syncRecentShiprocketOrders, syncShiprocketOrdersBySeller } from '@/lib/shiprocket-sync'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request) {
  try {
    const { user } = await requireRole(request, ['Seller', 'Admin'])
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(100, Math.max(1, Number(body?.limit || 100)))
    const lookbackDays = Math.min(90, Math.max(1, Number(body?.lookbackDays || 30)))

    const results = user.user_type === 'Admin'
      ? await syncRecentShiprocketOrders({ limit, lookbackDays })
      : await syncShiprocketOrdersBySeller({ sellerId: user.id, limit, lookbackDays })

    const updated = results.filter(result => !result.error && !result.skipped)
    const failed = results.filter(result => result.error)
    const skipped = results.filter(result => result.skipped)

    return NextResponse.json({
      success: true,
      message: `Synced ${updated.length} order${updated.length === 1 ? '' : 's'}`,
      totals: {
        processed: results.length,
        updated: updated.length,
        skipped: skipped.length,
        failed: failed.length
      },
      results
    })
  } catch (error) {
    console.error('Bulk Shiprocket sync failed:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
