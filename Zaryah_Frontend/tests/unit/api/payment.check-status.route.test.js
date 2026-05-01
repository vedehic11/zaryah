import { describe, expect, it, vi } from 'vitest'

async function loadRoute({ requireAuthImpl, ordersFetchImpl, fetchPaymentsImpl }) {
  vi.resetModules()

  const requireAuth = vi.fn(requireAuthImpl)
  const fetch = vi.fn(ordersFetchImpl)
  const fetchPayments = vi.fn(fetchPaymentsImpl)

  vi.doMock('@/lib/auth', () => ({
    requireAuth,
  }))

  vi.doMock('razorpay', () => ({
    default: class RazorpayMock {
      constructor() {
        this.orders = {
          fetch,
          fetchPayments,
        }
      }
    },
  }))

  const route = await import('@/app/api/payment/check-status/route')
  return { ...route, mocks: { requireAuth, fetch, fetchPayments } }
}

describe('/api/payment/check-status POST', () => {
  it('returns 400 when razorpayOrderId is missing', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      ordersFetchImpl: async () => ({ id: 'order_1', status: 'created' }),
      fetchPaymentsImpl: async () => ({ items: [] }),
    })

    const response = await POST(
      new Request('http://localhost/api/payment/check-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Order ID required' })
  })

  it('returns order and latest payment details on success', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-2' } }),
      ordersFetchImpl: async () => ({
        id: 'order_raz_1',
        status: 'paid',
        amount: 100000,
        amount_paid: 100000,
        amount_due: 0,
      }),
      fetchPaymentsImpl: async () => ({
        items: [
          {
            id: 'pay_1',
            status: 'captured',
            method: 'upi',
            amount: 100000,
            captured: true,
            error_code: null,
            error_description: null,
          },
        ],
      }),
    })

    const response = await POST(
      new Request('http://localhost/api/payment/check-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ razorpayOrderId: 'order_raz_1' }),
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.order).toMatchObject({ id: 'order_raz_1', status: 'paid' })
    expect(payload.payment).toMatchObject({ id: 'pay_1', status: 'captured' })
  })

  it('returns 500 when auth fails', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => {
        throw new Error('Unauthorized')
      },
      ordersFetchImpl: async () => ({ id: 'x' }),
      fetchPaymentsImpl: async () => ({ items: [] }),
    })

    const response = await POST(
      new Request('http://localhost/api/payment/check-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ razorpayOrderId: 'order_raz_x' }),
      })
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ error: 'Unauthorized' })
  })
})
