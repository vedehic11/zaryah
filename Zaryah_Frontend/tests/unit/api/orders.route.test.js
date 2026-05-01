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
    getBuyerId: vi.fn(),
    getSellerId: vi.fn(),
  }))

  vi.doMock('@/lib/supabase', () => ({
    supabase: { from },
  }))

  vi.doMock('@/lib/shiprocket', () => ({
    getShipmentTracking: vi.fn(),
    getShipmentDetails: vi.fn(),
    mapShiprocketStatus: vi.fn(() => ({ status: null })),
  }))

  const route = await import('@/app/api/orders/route')
  return { ...route, mocks: { requireAuth, getUserBySupabaseAuthId, from } }
}

function createOrdersBuilder(result, calls) {
  const builder = {
    select: () => builder,
    order: (...args) => {
      calls.push(['order', ...args])
      return builder
    },
    eq: (...args) => {
      calls.push(['eq', ...args])
      return builder
    },
    or: (...args) => {
      calls.push(['or', ...args])
      return builder
    },
    range: (...args) => {
      calls.push(['range', ...args])
      return builder
    },
    then: (resolve) => resolve(result),
  }
  return builder
}

describe('/api/orders GET', () => {
  it('returns 401 when auth fails', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => {
        throw new Error('Unauthorized')
      },
      getUserBySupabaseAuthIdImpl: async () => null,
      fromImpl: () => {
        throw new Error('db should not be called')
      },
    })

    const response = await GET(new Request('http://localhost/api/orders'))
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.error).toBe('Unauthorized')
  })

  it('filters by buyer_id for buyer user', async () => {
    const calls = []

    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'buyer-1', user_type: 'Buyer' }),
      fromImpl: (table) => {
        if (table !== 'orders') throw new Error('unexpected table')
        return createOrdersBuilder({ data: [], error: null }, calls)
      },
    })

    const response = await GET(new Request('http://localhost/api/orders'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(payload)).toBe(true)
    expect(calls.some(call => call[0] === 'eq' && call[1] === 'buyer_id' && call[2] === 'buyer-1')).toBe(true)
  })

  it('applies seller payment visibility filter for sellers', async () => {
    const calls = []

    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-2' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'seller-1', user_type: 'Seller' }),
      fromImpl: (table) => {
        if (table !== 'orders') throw new Error('unexpected table')
        return createOrdersBuilder({ data: [], error: null }, calls)
      },
    })

    const response = await GET(new Request('http://localhost/api/orders'))
    await response.json()

    expect(response.status).toBe(200)
    expect(calls.some(call => call[0] === 'eq' && call[1] === 'seller_id' && call[2] === 'seller-1')).toBe(true)
    expect(calls.some(call => call[0] === 'or' && String(call[1]).includes('payment_method.eq.cod'))).toBe(true)
  })
})
