import { describe, expect, it, vi } from 'vitest'

async function loadRoute({ requireAuthImpl, getUserBySupabaseAuthIdImpl, requireRoleImpl, fromImpl, rpcImpl, sendSellerOrderPlacedEmailImpl }) {
  vi.resetModules()

  const requireAuth = vi.fn(requireAuthImpl)
  const getUserBySupabaseAuthId = vi.fn(getUserBySupabaseAuthIdImpl)
  const requireRole = vi.fn(requireRoleImpl)
  const from = vi.fn(fromImpl)
  const rpc = vi.fn(rpcImpl || (async () => ({ data: null, error: null })))
  const sendSellerOrderPlacedEmail = vi.fn(sendSellerOrderPlacedEmailImpl)

  vi.doMock('@/lib/auth', () => ({
    requireAuth,
    getUserBySupabaseAuthId,
    requireRole,
    getBuyerId: vi.fn(),
    getSellerId: vi.fn(),
  }))

  vi.doMock('@/lib/supabase', () => ({
    supabase: { from, rpc },
  }))

  vi.doMock('@/lib/email', () => ({
    sendSellerOrderPlacedEmail,
  }))

  vi.doMock('@/lib/shiprocket', () => ({
    getShipmentTracking: vi.fn(),
    getShipmentDetails: vi.fn(),
    mapShiprocketStatus: vi.fn(() => ({ status: null })),
  }))

  const route = await import('@/app/api/orders/route')
  return { ...route, mocks: { requireAuth, getUserBySupabaseAuthId, requireRole, from, rpc, sendSellerOrderPlacedEmail } }
}

function createMutationBuilder(result) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    insert: () => builder,
    delete: () => builder,
    update: () => builder,
    single: async () => result,
    then: (resolve) => resolve(result),
  }

  return builder
}

function createOrdersPostMock({ selectCalls }) {
  const product = {
    name: 'Gift Box',
    price: 250,
    seller_id: 'seller-1',
    stock: 10,
    two_way_delivery: false,
    cod_available: true,
    sellers: { allow_cod: true },
  }

  const insertedOrder = {
    id: 'order-1',
    seller_id: 'seller-1',
    seller_amount: 242.5,
  }

  const completeOrder = {
    ...insertedOrder,
    order_items: [{ product_id: 'product-1', quantity: 1, price: 250 }],
  }

  return (table) => {
    if (table === 'products') {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: product, error: null }),
          }),
        }),
      }
    }

    if (table === 'orders') {
      return {
        insert: () => ({
          select: () => ({
            single: async () => ({ data: insertedOrder, error: null }),
          }),
        }),
        select: () => ({
          eq: () => ({
            single: async () => ({ data: completeOrder, error: null }),
          }),
        }),
      }
    }

    if (table === 'order_items' || table === 'transactions' || table === 'cart_items') {
      return createMutationBuilder({ data: null, error: null })
    }

    if (table === 'carts') {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { id: 'cart-1' }, error: null }),
          }),
        }),
      }
    }

    if (table === 'wallets') {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: null }),
          }),
        }),
        insert: () => createMutationBuilder({ data: null, error: null }),
        update: () => createMutationBuilder({ data: null, error: null }),
      }
    }

    if (table === 'sellers') {
      return {
        select: (selectArg) => {
          selectCalls.push(selectArg)
          return {
            eq: () => ({
              single: async () => ({
                data: {
                  business_name: 'Seller Biz',
                  username: 'sellerbiz',
                  users: {
                    email: 'seller@example.com',
                    name: 'Seller Name',
                    full_name: 'Seller Full Name',
                  },
                },
                error: null,
              }),
            }),
          }
        },
      }
    }

    if (table === 'users') {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: null }),
          }),
        }),
      }
    }

    throw new Error(`unexpected table: ${table}`)
  }
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

describe('/api/orders POST', () => {
  it('uses the linked seller user email when sending the order notification', async () => {
    const selectCalls = []
    const fromImpl = createOrdersPostMock({ selectCalls })

    const { POST, mocks } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-buyer' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'buyer-1', user_type: 'Buyer', name: 'Buyer Name' }),
      requireRoleImpl: async () => ({ user: { id: 'buyer-1', name: 'Buyer Name', email: 'buyer@example.com' } }),
      fromImpl,
      sendSellerOrderPlacedEmailImpl: async () => ({ id: 'msg-1' }),
    })

    const response = await POST(
      new Request('http://localhost/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              productId: 'product-1',
              quantity: 1,
              unitPrice: 250,
            },
          ],
          address: 'Buyer address',
          paymentMethod: 'cod',
          totalAmount: 250,
          deliveryFee: 0,
          giftPackagingFee: 0,
          codFee: 0,
          platformFee: 0,
          twoWayDelivery: false,
        }),
      })
    )

    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(selectCalls).toContain('business_name, username, users!sellers_id_fkey(email, name, full_name)')
    expect(mocks.sendSellerOrderPlacedEmail).toHaveBeenCalledTimes(1)
    expect(mocks.sendSellerOrderPlacedEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'seller@example.com',
      orderId: 'order-1',
      sellerName: 'Seller Biz',
      buyerName: 'Buyer Name',
    }))
    expect(payload.emailStatus).toEqual([
      expect.objectContaining({ sellerId: 'seller-1', to: 'seller@example.com', status: 'sent' }),
    ])
  })
})
