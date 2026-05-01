import { describe, expect, it, vi } from 'vitest'
import crypto from 'crypto'

async function loadRoute({ requireAuthImpl, getUserBySupabaseAuthIdImpl, fromImpl, rpcImpl }) {
  vi.resetModules()

  const requireAuth = vi.fn(requireAuthImpl)
  const getUserBySupabaseAuthId = vi.fn(getUserBySupabaseAuthIdImpl)
  const from = vi.fn(fromImpl)
  const rpc = vi.fn(rpcImpl || (async () => ({ data: null, error: null })))

  vi.doMock('@/lib/auth', () => ({
    requireAuth,
    getUserBySupabaseAuthId,
  }))

  vi.doMock('@/lib/supabase', () => ({
    supabase: { from, rpc },
  }))

  const route = await import('@/app/api/payment/verify/route')
  return { ...route, mocks: { requireAuth, getUserBySupabaseAuthId, from, rpc } }
}

function signature(orderId, paymentId, secret) {
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')
}

describe('/api/payment/verify POST', () => {
  it('returns 401 when auth fails', async () => {
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
      new Request('http://localhost/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: 'Unauthorized' })
  })

  it('returns 400 when required fields are missing', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-1' }),
      fromImpl: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
      }),
    })

    const response = await POST(
      new Request('http://localhost/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ razorpay_order_id: 'o1' }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Missing payment verification data' })
  })

  it('returns 400 when signature is invalid', async () => {
    process.env.RAZORPAY_KEY_SECRET = 'secret_1'

    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-1' }),
      fromImpl: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
      }),
    })

    const response = await POST(
      new Request('http://localhost/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_order_id: 'order_1',
          razorpay_payment_id: 'pay_1',
          razorpay_signature: 'bad',
        }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ success: false, error: 'Invalid payment signature' })
  })

  it('returns idempotent success when payment already credited', async () => {
    process.env.RAZORPAY_KEY_SECRET = 'secret_2'

    const updateEqMock = vi.fn(async () => ({ data: null, error: null }))

    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-1' }),
      fromImpl: (table) => {
        if (table === 'orders') {
          return {
            update: () => ({ eq: updateEqMock }),
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: 'order-1',
                    seller_id: 'seller-1',
                    seller_amount: 975,
                    order_items: [{ price: 100, quantity: 10 }],
                    gift_packaging_fee: 0,
                    platform_fee: 20,
                    delivery_fee: 0,
                  },
                  error: null,
                }),
              }),
            }),
          }
        }

        if (table === 'transactions') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: { id: 'tx-1' }, error: null }),
                  }),
                }),
              }),
            }),
          }
        }

        throw new Error(`unexpected table ${table}`)
      },
    })

    const reqBody = {
      razorpay_order_id: 'order_1',
      razorpay_payment_id: 'pay_1',
      razorpay_signature: signature('order_1', 'pay_1', 'secret_2'),
      order_id: 'order-1',
    }

    const response = await POST(
      new Request('http://localhost/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ success: true, idempotent: true })
    expect(updateEqMock).toHaveBeenCalledWith('id', 'order-1')
  })
})
