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

  const route = await import('@/app/api/cart/route')
  return { ...route, mocks: { requireAuth, getUserBySupabaseAuthId, from } }
}

describe('/api/cart route handlers', () => {
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

    const response = await GET(new Request('http://localhost/api/cart'))
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.error).toBe('Unauthorized')
  })

  it('GET returns empty cart payload when no cart exists', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'buyer-1' }),
      fromImpl: (table) => {
        if (table === 'carts') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }
        }
        throw new Error(`unexpected table: ${table}`)
      },
    })

    const response = await GET(new Request('http://localhost/api/cart'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.carts).toEqual([])
    expect(payload.totalItems).toBe(0)
    expect(payload.totalPrice).toBe(0)
  })

  it('GET groups items by seller and calculates totals', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'buyer-1' }),
      fromImpl: (table) => {
        if (table === 'carts') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { id: 'cart-1', buyer_id: 'buyer-1' }, error: null }),
              }),
            }),
          }
        }

        if (table === 'cart_items') {
          return {
            select: () => ({
              eq: async () => ({
                data: [
                  {
                    id: 'ci-1',
                    quantity: 2,
                    products: {
                      id: 'p1',
                      price: 100,
                      seller_id: 's1',
                      sellers: { business_name: 'Seller A', full_name: 'A' },
                    },
                  },
                  {
                    id: 'ci-2',
                    quantity: 1,
                    products: {
                      id: 'p2',
                      price: 200,
                      seller_id: 's1',
                      sellers: { business_name: 'Seller A', full_name: 'A' },
                    },
                  },
                  {
                    id: 'ci-3',
                    quantity: 1,
                    products: {
                      id: 'p3',
                      price: 50,
                      seller_id: 's2',
                      sellers: { business_name: 'Seller B', full_name: 'B' },
                    },
                  },
                ],
                error: null,
              }),
            }),
          }
        }

        throw new Error(`unexpected table: ${table}`)
      },
    })

    const response = await GET(new Request('http://localhost/api/cart'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.carts.length).toBe(2)
    expect(payload.totalItems).toBe(4)
    expect(payload.totalPrice).toBe(450)
  })

  it('POST returns 400 when productId is missing', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'buyer-1' }),
      fromImpl: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
      }),
    })

    const response = await POST(
      new Request('http://localhost/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 1 }),
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toBe('Product ID is required')
  })

  it('POST returns 404 when product is not found', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'buyer-1' }),
      fromImpl: (table) => {
        if (table === 'products') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: null, error: { message: 'not found' } }),
              }),
            }),
          }
        }
        throw new Error(`unexpected table: ${table}`)
      },
    })

    const response = await POST(
      new Request('http://localhost/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: 'p1', quantity: 1 }),
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(404)
    expect(payload.error).toBe('Product not found')
  })

  it('POST returns 400 when stock is insufficient', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'buyer-1' }),
      fromImpl: (table) => {
        if (table === 'products') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { id: 'p1', stock: 1, price: 100 }, error: null }),
              }),
            }),
          }
        }
        throw new Error(`unexpected table: ${table}`)
      },
    })

    const response = await POST(
      new Request('http://localhost/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: 'p1', quantity: 2 }),
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toBe('Insufficient stock')
  })

  it('DELETE returns already-empty message when cart does not exist', async () => {
    const { DELETE } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'buyer-1' }),
      fromImpl: (table) => {
        if (table === 'carts') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: null, error: null }),
              }),
            }),
          }
        }
        throw new Error(`unexpected table: ${table}`)
      },
    })

    const response = await DELETE(new Request('http://localhost/api/cart', { method: 'DELETE' }))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.message).toBe('Cart already empty')
  })
})
