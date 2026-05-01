import { describe, expect, it, vi } from 'vitest'

async function loadRoute({ requireAuthImpl, getUserBySupabaseAuthIdImpl, fromImpl }) {
  vi.resetModules()

  const requireAuth = vi.fn(requireAuthImpl)
  const getUserBySupabaseAuthId = vi.fn(getUserBySupabaseAuthIdImpl)
  const from = vi.fn(fromImpl)

  vi.doMock('@/lib/auth', () => ({
    requireAuth,
    getUserBySupabaseAuthId,
  }))

  vi.doMock('@/lib/supabase', () => ({
    supabase: { from },
  }))

  const route = await import('@/app/api/support/tickets/route')
  return { ...route, mocks: { requireAuth, getUserBySupabaseAuthId, from } }
}

describe('/api/support/tickets route handlers', () => {
  it('GET returns 401 when session is missing', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => {
        throw new Error('Unauthorized')
      },
      getUserBySupabaseAuthIdImpl: async () => null,
      fromImpl: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/support/tickets'))
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload.error).toBe('Internal server error')
  })

  it('GET returns tickets for admin without role filter', async () => {
    const query = {
      select: () => ({
        order: async () => ({ data: [{ id: 't1' }], error: null }),
        eq: () => ({ single: async () => ({ data: null, error: null }) }),
        or: () => ({ order: async () => ({ data: [{ id: 't1' }], error: null }) }),
      }),
    }

    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'admin-1', user_type: 'Admin' }),
      fromImpl: (table) => {
        if (table === 'support_tickets') return query
        if (table === 'buyers' || table === 'sellers') {
          return { select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) }
        }
        throw new Error(`unexpected table ${table}`)
      },
    })

    const response = await GET(new Request('http://localhost/api/support/tickets'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(payload)).toBe(true)
    expect(payload[0].id).toBe('t1')
  })

  it('POST returns 400 when subject or message is missing', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-2' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-2', user_type: 'Buyer', email: 'u@test.com' }),
      fromImpl: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'user-2' }, error: null }) }) }),
        insert: () => ({ select: () => ({ single: async () => ({ data: { id: 't2' }, error: null }) }) }),
      }),
    })

    const response = await POST(
      new Request('http://localhost/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: '', message: '' }),
      })
    )

    const payload = await response.json()
    expect(response.status).toBe(400)
    expect(payload.error).toContain('Subject and message are required')
  })
})
