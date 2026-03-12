import { NextResponse } from 'next/server'
import { syncRecentShiprocketOrders } from '@/lib/shiprocket-sync'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET || process.env.SHIPROCKET_SYNC_SECRET
  const vercelCronHeader = request.headers.get('x-vercel-cron')
  const authHeader = request.headers.get('authorization') || ''
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (vercelCronHeader) {
    return true
  }

  if (cronSecret && bearerToken === cronSecret) {
    return true
  }

  return false
}

export async function GET(request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || '25')))
    const lookbackDays = Math.min(90, Math.max(1, Number(request.nextUrl.searchParams.get('lookbackDays') || '30')))

    const results = await syncRecentShiprocketOrders({ limit, lookbackDays })
    const updated = results.filter(result => !result.error && !result.skipped)
    const failed = results.filter(result => result.error)
    const skipped = results.filter(result => result.skipped)

    return NextResponse.json({
      success: true,
      syncedAt: new Date().toISOString(),
      limit,
      lookbackDays,
      totals: {
        processed: results.length,
        updated: updated.length,
        skipped: skipped.length,
        failed: failed.length
      },
      results
    })
  } catch (error) {
    console.error('Shiprocket cron sync failed:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
