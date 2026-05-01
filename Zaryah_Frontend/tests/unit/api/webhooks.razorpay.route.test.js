import { describe, expect, it, vi } from 'vitest'
import crypto from 'crypto'

async function loadRoute({ fromImpl }) {
  vi.resetModules()

  const from = vi.fn(fromImpl)

  vi.doMock('@/lib/supabase', () => ({
    supabase: { from },
  }))

  const route = await import('@/app/api/webhooks/razorpay/route')
  return { ...route, mocks: { from } }
}

function signPayload(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

describe('/api/webhooks/razorpay POST', () => {
  it('returns 400 for invalid webhook signature', async () => {
    process.env.RAZORPAY_KEY_SECRET = 'test_secret'

    const { POST } = await loadRoute({
      fromImpl: () => {
        throw new Error('db should not be called')
      },
    })

    const payload = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: {} } } })
    const response = await POST(
      new Request('http://localhost/api/webhooks/razorpay', {
        method: 'POST',
        headers: { 'x-razorpay-signature': 'invalid-signature' },
        body: payload,
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Invalid signature' })
  })

  it('handles payment.captured and marks matching order as paid', async () => {
    process.env.RAZORPAY_KEY_SECRET = 'test_secret'

    const updateEqMock = vi.fn(async () => ({ data: null, error: null }))

    const { POST } = await loadRoute({
      fromImpl: (table) => {
        if (table === 'orders') {
          return {
            select: () => ({
              or: () => ({
                eq: async () => ({
                  data: [
                    {
                      id: 'order-1',
                      payment_status: 'pending',
                      payment_method: 'online',
                      wallet_credited: false,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
            update: () => ({ eq: updateEqMock }),
          }
        }

        throw new Error(`unexpected table ${table}`)
      },
    })

    const event = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_123',
            order_id: 'order_ref_1',
          },
        },
      },
    }
    const payload = JSON.stringify(event)
    const signature = signPayload(payload, 'test_secret')

    const response = await POST(
      new Request('http://localhost/api/webhooks/razorpay', {
        method: 'POST',
        headers: { 'x-razorpay-signature': signature },
        body: payload,
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ received: true })
    expect(updateEqMock).toHaveBeenCalledWith('id', 'order-1')
  })

  it('handles payment.failed and marks matched orders as failed', async () => {
    process.env.RAZORPAY_KEY_SECRET = 'test_secret'

    const failedUpdateEqMock = vi.fn(async () => ({ data: null, error: null }))

    const { POST } = await loadRoute({
      fromImpl: (table) => {
        if (table === 'orders') {
          return {
            select: () => ({
              or: () => ({
                eq: async () => ({ data: [], error: null }),
              }),
              eq: async () => ({ data: [{ id: 'order-fail-1' }], error: null }),
            }),
            update: () => ({ eq: failedUpdateEqMock }),
          }
        }
        throw new Error(`unexpected table ${table}`)
      },
    })

    const event = {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            order_id: 'order_ref_failed',
          },
        },
      },
    }
    const payload = JSON.stringify(event)
    const signature = signPayload(payload, 'test_secret')

    const response = await POST(
      new Request('http://localhost/api/webhooks/razorpay', {
        method: 'POST',
        headers: { 'x-razorpay-signature': signature },
        body: payload,
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ received: true })
    expect(failedUpdateEqMock).toHaveBeenCalledWith('id', 'order-fail-1')
  })
})
