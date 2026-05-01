import { describe, expect, it, vi } from 'vitest'

async function loadRoute({ requireAuthImpl, getUserBySupabaseAuthIdImpl, fromImpl }) {
  vi.resetModules()

  const requireAuth = vi.fn(requireAuthImpl)
  const getUserBySupabaseAuthId = vi.fn(getUserBySupabaseAuthIdImpl)
  const from = vi.fn(fromImpl)

  vi.doMock('@/lib/auth', () => ({
    requireAuth,
    getUserBySupabaseAuthId,
    requireRole: vi.fn(),
  }))

  vi.doMock('@/lib/supabase', () => ({
    supabase: { from },
  }))

  const route = await import('@/app/api/wallet/route')
  return { ...route, mocks: { requireAuth, getUserBySupabaseAuthId, from } }
}

describe('/api/wallet GET', () => {
  it('returns 401 when auth throws Unauthorized', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => {
        throw new Error('Unauthorized')
      },
      getUserBySupabaseAuthIdImpl: async () => null,
      fromImpl: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/wallet'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: 'Unauthorized' })
  })

  it('returns 403 for non-seller users', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'u1', user_type: 'Buyer' }),
      fromImpl: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/wallet'))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ error: 'Only sellers have wallets' })
  })

  it('returns 500 when fetching orders fails', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-2' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'seller-1', user_type: 'Seller' }),
      fromImpl: (table) => {
        if (table === 'orders') {
          return {
            select: () => ({
              eq: async () => ({ data: null, error: { message: 'orders down' } }),
            }),
          }
        }

        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
        }
      },
    })

    const response = await GET(new Request('http://localhost/api/wallet'))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ error: 'orders down' })
  })
})
