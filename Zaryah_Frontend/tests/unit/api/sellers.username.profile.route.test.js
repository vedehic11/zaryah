import { describe, expect, it, vi } from 'vitest'

async function loadRoute({ fromImpl }) {
  vi.resetModules()
  const from = vi.fn(fromImpl)

  vi.doMock('@/lib/supabase', () => ({
    supabase: { from },
  }))

  const route = await import('@/app/api/sellers/username/[username]/route')
  return { ...route, mocks: { from } }
}

describe('/api/sellers/username/[username] GET', () => {
  it('returns 400 when username param is empty', async () => {
    const { GET } = await loadRoute({
      fromImpl: () => ({
        select: () => ({ ilike: () => ({ single: async () => ({ data: null, error: null }) }) }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/sellers/username/'), {
      params: Promise.resolve({ username: '' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Username is required' })
  })

  it('returns 404 when seller is not found', async () => {
    const { GET } = await loadRoute({
      fromImpl: (table) => {
        if (table === 'sellers') {
          return {
            select: () => ({
              ilike: () => ({
                single: async () => ({ data: null, error: { message: 'not found' } }),
              }),
            }),
          }
        }

        if (table === 'users') {
          return { select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) }
        }

        if (table === 'products') {
          return { select: () => ({ eq: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }) }) }
        }

        throw new Error(`unexpected table ${table}`)
      },
    })

    const response = await GET(new Request('http://localhost/api/sellers/username/acme'), {
      params: Promise.resolve({ username: 'acme' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ error: 'Seller not found' })
  })

  it('returns 404 when seller user is not approved', async () => {
    const { GET } = await loadRoute({
      fromImpl: (table) => {
        if (table === 'sellers') {
          return {
            select: () => ({
              ilike: () => ({
                single: async () => ({ data: { id: 's1', username: 'acme', business_name: 'Acme' }, error: null }),
              }),
            }),
          }
        }

        if (table === 'users') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { id: 's1', user_type: 'Seller', is_approved: false }, error: null }),
              }),
            }),
          }
        }

        if (table === 'products') {
          return { select: () => ({ eq: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }) }) }
        }

        throw new Error(`unexpected table ${table}`)
      },
    })

    const response = await GET(new Request('http://localhost/api/sellers/username/acme'), {
      params: Promise.resolve({ username: 'acme' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ error: 'Seller not found' })
  })

  it('returns seller profile with approved products and stats', async () => {
    const { GET } = await loadRoute({
      fromImpl: (table) => {
        if (table === 'sellers') {
          return {
            select: () => ({
              ilike: () => ({
                single: async () => ({
                  data: { id: 's2', username: 'acme', business_name: 'Acme Gifts' },
                  error: null,
                }),
              }),
            }),
          }
        }

        if (table === 'users') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { id: 's2', user_type: 'Seller', is_approved: true, name: 'Acme' },
                  error: null,
                }),
              }),
            }),
          }
        }

        if (table === 'products') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: async () => ({
                    data: [
                      {
                        id: 'p1',
                        seller_id: 's2',
                        name: 'Gift Box',
                        description: 'Desc',
                        price: '499',
                        images: ['a.jpg'],
                        status: 'approved',
                        created_at: '2025-01-01T00:00:00.000Z',
                        product_ratings: [{ rating: 4 }, { rating: 5 }],
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }

        throw new Error(`unexpected table ${table}`)
      },
    })

    const response = await GET(new Request('http://localhost/api/sellers/username/acme'), {
      params: Promise.resolve({ username: 'acme' }),
    })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.products.length).toBe(1)
    expect(payload.products[0]).toMatchObject({ id: 'p1', averageRating: 4.5, ratingCount: 2 })
    expect(payload.stats).toMatchObject({ productsCount: 1, averageRating: '4.5' })
  })
})
