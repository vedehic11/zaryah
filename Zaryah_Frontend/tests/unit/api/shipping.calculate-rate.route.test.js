import { describe, expect, it, vi } from 'vitest'

async function loadRoute({ calculateShippingRatesImpl, getCheapestShippingRateImpl, normalizeWeightToKgImpl, fromImpl }) {
  vi.resetModules()

  const calculateShippingRates = vi.fn(calculateShippingRatesImpl)
  const getCheapestShippingRate = vi.fn(getCheapestShippingRateImpl)
  const normalizeWeightToKg = vi.fn(normalizeWeightToKgImpl)
  const from = vi.fn(fromImpl)

  vi.doMock('@/lib/shiprocket', () => ({
    calculateShippingRates,
    getCheapestShippingRate,
  }))

  vi.doMock('@/lib/weight', () => ({
    normalizeWeightToKg,
  }))

  vi.doMock('@/lib/supabase', () => ({
    supabase: { from },
  }))

  const route = await import('@/app/api/shipping/calculate-rate/route')
  return { ...route, mocks: { calculateShippingRates, getCheapestShippingRate, normalizeWeightToKg, from } }
}

describe('/api/shipping/calculate-rate POST', () => {
  it('returns 400 for invalid delivery pincode', async () => {
    const { POST } = await loadRoute({
      calculateShippingRatesImpl: async () => [],
      getCheapestShippingRateImpl: async () => 50,
      normalizeWeightToKgImpl: () => 0.5,
      fromImpl: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) }),
    })

    const response = await POST(
      new Request('http://localhost/api/shipping/calculate-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryPincode: '1234' }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Invalid delivery pincode' })
  })

  it('returns cheapest delivery charge with fallback weight/pickup defaults', async () => {
    const { POST, mocks } = await loadRoute({
      calculateShippingRatesImpl: async () => [],
      getCheapestShippingRateImpl: async () => 79,
      normalizeWeightToKgImpl: () => 0,
      fromImpl: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) }),
    })

    const response = await POST(
      new Request('http://localhost/api/shipping/calculate-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryPincode: '560001',
          cartItems: [{ quantity: 2 }],
          returnAllOptions: false,
        }),
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      success: true,
      deliveryCharge: 79,
      weight: 0.5,
      pickupPincode: '400001',
      deliveryPincode: '560001',
    })
    expect(mocks.getCheapestShippingRate).toHaveBeenCalled()
  })

  it('returns all options and cheapest when returnAllOptions is true', async () => {
    const { POST, mocks } = await loadRoute({
      calculateShippingRatesImpl: async () => [
        { courier_name: 'Fast', total_charge: 99 },
        { courier_name: 'Slow', total_charge: 120 },
      ],
      getCheapestShippingRateImpl: async () => 0,
      normalizeWeightToKgImpl: () => 0.75,
      fromImpl: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { pincode: '411001' }, error: null }),
          }),
        }),
      }),
    })

    const response = await POST(
      new Request('http://localhost/api/shipping/calculate-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryPincode: '700001',
          codAmount: 100,
          returnAllOptions: true,
          cartItems: [{ seller_id: 'seller-1', weight: 0.5, quantity: 2 }],
        }),
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      success: true,
      pickupPincode: '411001',
      deliveryPincode: '700001',
      weight: 1.5,
      cheapest: 99,
    })
    expect(payload.couriers.length).toBe(2)
    expect(mocks.calculateShippingRates).toHaveBeenCalled()
  })

  it('returns fallback payload when shiprocket throws', async () => {
    const { POST } = await loadRoute({
      calculateShippingRatesImpl: async () => {
        throw new Error('shiprocket down')
      },
      getCheapestShippingRateImpl: async () => {
        throw new Error('shiprocket down')
      },
      normalizeWeightToKgImpl: () => 1,
      fromImpl: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) }),
    })

    const response = await POST(
      new Request('http://localhost/api/shipping/calculate-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryPincode: '560001',
          cartItems: [{ weight: 1, quantity: 1 }],
          returnAllOptions: false,
        }),
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      success: true,
      deliveryCharge: 50,
      fallback: true,
      error: 'shiprocket down',
    })
  })
})
