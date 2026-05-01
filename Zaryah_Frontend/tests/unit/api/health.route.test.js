import { describe, expect, it, vi } from 'vitest'

async function loadRouteWithSupabase(supabaseValue) {
  vi.resetModules()
  vi.doMock('@/lib/supabase', () => ({ supabase: supabaseValue }))
  return import('@/app/api/health/route')
}

describe('/api/health GET', () => {
  it('returns 500 when supabase client is missing', async () => {
    const { GET } = await loadRouteWithSupabase(null)
    const response = await GET()
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload.status).toBe('error')
    expect(payload.message).toContain('Supabase client not initialized')
  })

  it('returns 500 when database query fails', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          limit: async () => ({ data: null, error: { message: 'boom' } }),
        }),
      }),
    }

    const { GET } = await loadRouteWithSupabase(supabase)
    const response = await GET()
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload.status).toBe('error')
    expect(payload.message).toBe('Database connection failed')
  })

  it('returns 200 when health check succeeds', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          limit: async () => ({ data: [{ count: 1 }], error: null }),
        }),
      }),
    }

    const { GET } = await loadRouteWithSupabase(supabase)
    const response = await GET()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.status).toBe('ok')
    expect(payload.database).toBe('connected')
  })
})
