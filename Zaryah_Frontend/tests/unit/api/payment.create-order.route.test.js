import { beforeEach, describe, expect, it, vi } from 'vitest'

const { razorpayOrdersCreateMock } = vi.hoisted(() => ({
  razorpayOrdersCreateMock: vi.fn(),
}))

vi.mock('razorpay', () => ({
  default: function RazorpayMock() {
    return {
      orders: {
        create: razorpayOrdersCreateMock,
      },
    }
  },
}))

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

  const route = await import('@/app/api/payment/create-order/route')
  return { ...route, mocks: { requireAuth, getUserBySupabaseAuthId, from } }
}

describe('/api/payment/create-order POST', () => {
  beforeEach(() => {
    razorpayOrdersCreateMock.mockReset()
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = 'rzp_test_key'
    process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret'
  })

  it('returns 401 when auth fails', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => {
        throw new Error('Unauthorized')
      },
      getUserBySupabaseAuthIdImpl: async () => null,
      fromImpl: () => {
        throw new Error('db should not be called')
      },
    })

    const response = await POST(
      new Request('http://localhost/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 1000 }),
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.error).toBe('Unauthorized')
  })

  it('returns 400 for invalid amount', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-1', email: 'u@test.com' }),
      fromImpl: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
      }),
    })

    const response = await POST(
      new Request('http://localhost/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 0 }),
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toBe('Invalid amount')
  })

  it('returns 404 when orderId is provided but order not found', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-1', email: 'u@test.com' }),
      fromImpl: (table) => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: { message: 'not found' } }),
          }),
        }),
      }),
    })

    const response = await POST(
      new Request('http://localhost/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 1000, orderId: 'order-1' }),
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(404)
    expect(payload.error).toBe('Order not found')
  })

  it('returns 400 when amount mismatches order total', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-1', email: 'u@test.com' }),
      fromImpl: (table) => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: { total_amount: 500, commission_amount: 12.5, seller_amount: 487.5 },
              error: null,
            }),
          }),
        }),
      }),
    })

    const response = await POST(
      new Request('http://localhost/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 100000, orderId: 'order-1' }),
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toBe('Payment amount mismatch')
  })

  it('creates razorpay order and updates order payment fields', async () => {
    const updateEqMock = vi.fn(async () => ({ data: null, error: null }))
    const ordersSingleMock = vi.fn(async () => ({
      data: { total_amount: 1000, commission_amount: 25, seller_amount: 975 },
      error: null,
    }))

    razorpayOrdersCreateMock.mockResolvedValue({
      id: 'rzp_order_123',
      amount: 100000,
      currency: 'INR',
      receipt: 'ord_123_user',
    })

    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-1', email: 'u@test.com' }),
      fromImpl: (table) => {
        if (table === 'orders') {
          return {
            select: () => ({ eq: () => ({ single: ordersSingleMock }) }),
            update: () => ({ eq: updateEqMock }),
          }
        }

        throw new Error(`unexpected table ${table}`)
      },
    })

    const response = await POST(
      new Request('http://localhost/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 100000, orderId: 'order-1', notes: { source: 'test' } }),
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.order_id).toBe('rzp_order_123')
    expect(payload.commission_amount).toBe(25)
    expect(payload.seller_amount).toBe(975)

    expect(razorpayOrdersCreateMock).toHaveBeenCalledTimes(1)
    expect(updateEqMock).toHaveBeenCalledWith('id', 'order-1')
  })
})
