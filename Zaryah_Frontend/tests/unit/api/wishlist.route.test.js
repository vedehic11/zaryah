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

  const route = await import('@/app/api/wishlist/route')
  return { ...route, mocks: { requireAuth, getUserBySupabaseAuthId, from } }
}

describe('/api/wishlist route handlers', () => {
  it('GET returns 401 when auth fails', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => {
        throw new Error('Unauthorized')
      },
      getUserBySupabaseAuthIdImpl: async () => null,
      fromImpl: () => {
        throw new Error('db should not be called')
      },
    })

    const response = await GET(new Request('http://localhost/api/wishlist'))
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.error).toBe('Unauthorized')
  })

  it('GET returns 404 when user is missing', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => null,
      fromImpl: () => {
        throw new Error('db should not be called')
      },
    })

    const response = await GET(new Request('http://localhost/api/wishlist'))
    const payload = await response.json()

    expect(response.status).toBe(404)
    expect(payload.error).toContain('User not found')
  })

  it('GET returns transformed wishlist items', async () => {
    const listQuery = {
      select: () => ({
        eq: () => ({
          order: async () => ({
            data: [
              {
                id: 'w1',
                product_id: 'p1',
                created_at: '2024-01-01T00:00:00Z',
                products: {
                  id: 'p1',
                  name: 'Item 1',
                  sellers: { id: 's1', username: 'seller1', business_name: 'Biz 1', city: 'Mumbai' },
                },
              },
            ],
            error: null,
          }),
        }),
      }),
    }

    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-1' }),
      fromImpl: () => listQuery,
    })

    const response = await GET(new Request('http://localhost/api/wishlist'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(payload)).toBe(true)
    expect(payload[0].product.seller.username).toBe('seller1')
  })

  it('POST returns 400 when product_id is missing', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-1' }),
      fromImpl: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) }),
      }),
    })

    const request = new Request('http://localhost/api/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toBe('Product ID is required')
  })

  it('POST returns exists=true when wishlist row already exists', async () => {
    const existsQuery = {
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: async () => ({ data: { id: 'w1' }, error: null }),
          }),
        }),
      }),
    }

    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-1' }),
      fromImpl: () => existsQuery,
    })

    const request = new Request('http://localhost/api/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: 'p1' }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.exists).toBe(true)
  })

  it('POST inserts wishlist item when not existing', async () => {
    const query = {
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: null }),
          }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: async () => ({ data: { id: 'w2', product_id: 'p2' }, error: null }),
        }),
      }),
    }

    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-1' }),
      fromImpl: () => query,
    })

    const request = new Request('http://localhost/api/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: 'p2' }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.message).toBe('Added to wishlist')
    expect(payload.data.id).toBe('w2')
  })

  it('DELETE returns 400 when product_id query is missing', async () => {
    const { DELETE } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-1' }),
      fromImpl: () => ({
        delete: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
      }),
    })

    const response = await DELETE(new Request('http://localhost/api/wishlist'))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toBe('Product ID is required')
  })

  it('DELETE removes item when product_id is provided', async () => {
    const query = {
      delete: () => ({
        eq: () => ({
          eq: async () => ({ error: null }),
        }),
      }),
    }

    const { DELETE } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-1' }),
      fromImpl: () => query,
    })

    const response = await DELETE(new Request('http://localhost/api/wishlist?product_id=p1'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.message).toBe('Removed from wishlist')
  })
})
