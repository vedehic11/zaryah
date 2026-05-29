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

  const route = await import('@/app/api/reviews/can-review/route')
  return { ...route, mocks: { requireAuth, getUserBySupabaseAuthId, from } }
}

describe('/api/reviews/can-review GET', () => {
  it('returns canReview false when not authenticated', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: null }),
      getUserBySupabaseAuthIdImpl: async () => null,
      fromImpl: () => ({ select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) }) }),
    })

    const response = await GET(new Request('http://localhost/api/reviews/can-review?sellerId=s1'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ canReview: false, reason: 'Not authenticated' })
  })

  it('returns 400 when sellerId is missing', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-1' }),
      fromImpl: () => ({ select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) }) }),
    })

    const response = await GET(new Request('http://localhost/api/reviews/can-review'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Seller ID is required' })
  })

  it('returns canReview false when seller is already reviewed', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-2' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-2' }),
      fromImpl: (table) => {
        if (table === 'seller_reviews') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: async () => ({ data: { id: 'r1' }, error: null }),
                }),
              }),
            }),
          }
        }

        if (table === 'orders') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    order: () => ({
                      limit: async () => ({ data: [{ id: 'o1' }], error: null }),
                    }),
                  }),
                }),
              }),
            }),
          }
        }

        throw new Error(`unexpected table ${table}`)
      },
    })

    const response = await GET(new Request('http://localhost/api/reviews/can-review?sellerId=s2'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ canReview: false, reason: 'Already reviewed' })
  })

  it('returns canReview true with orderId when delivered purchase exists', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-3' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-3' }),
      fromImpl: (table) => {
        if (table === 'seller_reviews') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          }
        }

        if (table === 'orders') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    order: () => ({
                      limit: async () => ({ data: [{ id: 'o-delivered' }], error: null }),
                    }),
                  }),
                }),
              }),
            }),
          }
        }

        throw new Error(`unexpected table ${table}`)
      },
    })

    const response = await GET(new Request('http://localhost/api/reviews/can-review?sellerId=s3'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ canReview: true, orderId: 'o-delivered' })
  })
})
