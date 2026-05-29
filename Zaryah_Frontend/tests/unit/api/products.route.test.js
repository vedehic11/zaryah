import { describe, expect, it, vi } from 'vitest'

async function loadRoute({ requireAuthImpl, checkUserRoleImpl, fromImpl }) {
  vi.resetModules()

  const requireAuth = vi.fn(requireAuthImpl)
  const checkUserRole = vi.fn(checkUserRoleImpl)
  const from = vi.fn(fromImpl)

  vi.doMock('@/lib/auth', () => ({
    requireAuth,
    checkUserRole,
  }))

  vi.doMock('@/lib/supabase', () => ({
    supabase: { from },
  }))

  const route = await import('@/app/api/products/route')
  return { ...route, mocks: { requireAuth, checkUserRole, from } }
}

describe('/api/products GET', () => {
  function createQueryMock({ onOrder }) {
    const eqCalls = []
    const query = {
      eq(field, value) {
        eqCalls.push([field, value])
        return query
      },
      async order() {
        return onOrder(eqCalls)
      },
    }

    return { query, eqCalls }
  }

  it('applies approved filter for public requests', async () => {
    const { query, eqCalls } = createQueryMock({
      onOrder: async () => ({
        data: [
          {
            id: 'p1',
            name: 'Prod',
            description: 'desc',
            price: '100',
            images: [],
            category: 'Other',
            section: 'Featured',
            weight: 1,
            stock: 10,
            customisable: false,
            features: [],
            delivery_time_min: 1,
            delivery_time_max: 2,
            delivery_time_unit: 'days',
            instant_delivery: false,
            mrp: null,
            size_options: [],
            material: null,
            care_instructions: null,
            return_available: true,
            return_days: 7,
            cod_available: true,
            legal_disclaimer: null,
            is_genuine: true,
            is_quality_checked: true,
            status: 'approved',
            created_at: '2024-01-01T00:00:00Z',
            seller_id: 's1',
            sellers: { id: 's1', business_name: 'Biz', full_name: 'Seller', username: 'seller', city: 'Mumbai' },
            product_ratings: [{ rating: 4 }, { rating: 5 }],
          },
        ],
        error: null,
      }),
    })

    const { GET } = await loadRoute({
      requireAuthImpl: async () => {
        throw new Error('Unauthorized')
      },
      checkUserRoleImpl: async () => false,
      fromImpl: (table) => {
        if (table === 'products') {
          return { select: () => query }
        }

        if (table === 'seller_reviews') {
          return {
            select: () => ({
              in: async () => ({
                data: [
                  { seller_id: 's1', rating: 4 },
                  { seller_id: 's1', rating: 5 },
                ],
                error: null,
              }),
            }),
          }
        }

        return { select: () => query }
      },
    })

    const response = await GET(new Request('http://localhost/api/products'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(eqCalls.some(([f, v]) => f === 'status' && v === 'approved')).toBe(true)
    expect(payload[0].averageRating).toBe(4.5)
    expect(payload[0].seller.username).toBe('seller')
  })

  it('does not force approved filter for admin requests', async () => {
    const { query, eqCalls } = createQueryMock({
      onOrder: async () => ({ data: [], error: null }),
    })

    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      checkUserRoleImpl: async () => true,
      fromImpl: (table) => {
        if (table === 'products') {
          return { select: () => query }
        }

        if (table === 'seller_reviews') {
          return {
            select: () => ({
              in: async () => ({
                data: [
                  { seller_id: 's1', rating: 4 },
                  { seller_id: 's1', rating: 5 },
                ],
                error: null,
              }),
            }),
          }
        }

        return { select: () => query }
      },
    })

    const response = await GET(new Request('http://localhost/api/products?admin=true'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(payload)).toBe(true)
    expect(eqCalls.some(([f, v]) => f === 'status' && v === 'approved')).toBe(false)
  })

  it('returns 500 when supabase query errors', async () => {
    const { query } = createQueryMock({
      onOrder: async () => ({ data: null, error: { message: 'db boom' } }),
    })

    const { GET } = await loadRoute({
      requireAuthImpl: async () => {
        throw new Error('Unauthorized')
      },
      checkUserRoleImpl: async () => false,
      fromImpl: () => ({
        select: () => query,
      }),
    })

    const response = await GET(new Request('http://localhost/api/products'))
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload.error).toBe('db boom')
  })

  it('retries without archived filter when the column is missing', async () => {
    const eqCalls = []
    let attempt = 0
    const query = {
      eq(field, value) {
        eqCalls.push([field, value])
        return query
      },
      async order() {
        attempt += 1
        if (attempt === 1) {
          return { data: null, error: { message: 'column products.archived does not exist' } }
        }

        return {
          data: [
            {
              id: 'p1',
              name: 'Prod',
              description: 'desc',
              price: '100',
              images: [],
              category: 'Other',
              section: 'Featured',
              weight: 1,
              stock: 10,
              customisable: false,
              features: [],
              delivery_time_min: 1,
              delivery_time_max: 2,
              delivery_time_unit: 'days',
              instant_delivery: false,
              mrp: null,
              size_options: [],
              material: null,
              care_instructions: null,
              return_available: true,
              return_days: 7,
              cod_available: true,
              legal_disclaimer: null,
              is_genuine: true,
              is_quality_checked: true,
              status: 'approved',
              created_at: '2024-01-01T00:00:00Z',
              seller_id: 's1',
              sellers: { id: 's1', business_name: 'Biz', full_name: 'Seller', username: 'seller', city: 'Mumbai' },
              product_ratings: [{ rating: 4 }, { rating: 5 }],
            },
          ],
          error: null,
        }
      },
    }

    const { GET } = await loadRoute({
      requireAuthImpl: async () => {
        throw new Error('Unauthorized')
      },
      checkUserRoleImpl: async () => false,
      fromImpl: (table) => {
        if (table === 'products') {
          return { select: () => query }
        }

        if (table === 'seller_reviews') {
          return {
            select: () => ({
              in: async () => ({
                data: [
                  { seller_id: 's1', rating: 4 },
                  { seller_id: 's1', rating: 5 },
                ],
                error: null,
              }),
            }),
          }
        }

        return { select: () => query }
      },
    })

    const response = await GET(new Request('http://localhost/api/products'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload[0].averageRating).toBe(4.5)
    expect(eqCalls.filter(([field, value]) => field === 'archived' && value === false)).toHaveLength(1)
  })
})
