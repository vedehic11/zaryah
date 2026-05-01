import { describe, expect, it, vi } from 'vitest'

async function loadRoute({ requireAuthImpl, getUserBySupabaseAuthIdImpl, fromImpl }) {
  vi.resetModules()

  const requireAuth = vi.fn(requireAuthImpl)
  const getUserBySupabaseAuthId = vi.fn(getUserBySupabaseAuthIdImpl)
  const from = vi.fn(fromImpl)

  vi.doMock('@/lib/supabase', () => ({
    supabase: { from },
  }))

  vi.doMock('@/lib/auth', () => ({
    requireAuth,
    getUserBySupabaseAuthId,
  }))

  const route = await import('@/app/api/reviews/route')
  return { ...route, mocks: { requireAuth, getUserBySupabaseAuthId, from } }
}

describe('/api/reviews route handlers', () => {
  it('GET returns 400 when productId missing', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'a' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'u1' }),
      fromImpl: () => ({
        select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/reviews'))
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Product ID is required' })
  })

  it('GET returns reviews for productId', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'a' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'u1' }),
      fromImpl: () => ({
        select: () => ({ eq: () => ({ order: async () => ({ data: [{ id: 'r1' }], error: null }) }) }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/reviews?productId=p1'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload[0].id).toBe('r1')
  })

  it('POST returns 500 when auth throws (current behavior)', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => {
        throw new Error('Unauthorized')
      },
      getUserBySupabaseAuthIdImpl: async () => null,
      fromImpl: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
      }),
    })

    const response = await POST(
      new Request('http://localhost/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: 'p1', rating: 5 }),
      })
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ error: 'Internal server error' })
  })

  it('POST returns 400 for rating out of range', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'u1' }),
      fromImpl: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
      }),
    })

    const response = await POST(
      new Request('http://localhost/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: 'p1', rating: 6 }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Rating must be between 1 and 5' })
  })

  it('POST returns 403 when no delivered purchase found', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-2' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'buyer-1' }),
      fromImpl: (table) => {
        if (table === 'orders') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: async () => ({ data: [], error: null }),
                }),
              }),
            }),
          }
        }

        if (table === 'product_ratings') {
          return {
            select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) }),
          }
        }

        throw new Error(`unexpected table ${table}`)
      },
    })

    const response = await POST(
      new Request('http://localhost/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: 'p1', rating: 4, review: 'Nice' }),
      })
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ error: 'You can only review products you have purchased and received' })
  })

  it('POST returns 400 when review already exists', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-3' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'buyer-1' }),
      fromImpl: (table) => {
        if (table === 'orders') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: async () => ({ data: [{ id: 'o1' }], error: null }),
                }),
              }),
            }),
          }
        }

        if (table === 'product_ratings') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: async () => ({ data: { id: 'r1' }, error: null }),
                }),
              }),
            }),
            insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'r2' }, error: null }) }) }),
          }
        }

        throw new Error(`unexpected table ${table}`)
      },
    })

    const response = await POST(
      new Request('http://localhost/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: 'p1', rating: 5, review: 'Great' }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'You have already reviewed this product' })
  })
})
