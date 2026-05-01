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

  const route = await import('@/app/api/cart/items/[id]/route')
  return { ...route, mocks: { requireAuth, getUserBySupabaseAuthId, from } }
}

describe('/api/cart/items/[id] route handlers', () => {
  it('PUT returns 404 when cart item is missing', async () => {
    const { PUT } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'buyer-1' }),
      fromImpl: (table) => {
        if (table === 'cart_items') {
          return {
            select: () => ({ eq: () => ({ single: async () => ({ data: null, error: { message: 'nf' } }) }) }),
          }
        }
        if (table === 'products') {
          return { select: () => ({ eq: () => ({ single: async () => ({ data: { stock: 10 }, error: null }) }) }) }
        }
        throw new Error(`unexpected table ${table}`)
      },
    })

    const response = await PUT(
      new Request('http://localhost/api/cart/items/i1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 2 }),
      }),
      { params: Promise.resolve({ id: 'i1' }) }
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ error: 'Cart item not found' })
  })

  it('PUT returns 400 when requested quantity exceeds stock', async () => {
    const { PUT } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-2' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'buyer-2' }),
      fromImpl: (table) => {
        if (table === 'cart_items') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { id: 'i2', product_id: 'p2', carts: { buyer_id: 'buyer-2' } }, error: null }),
              }),
            }),
            update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }) }),
          }
        }

        if (table === 'products') {
          return {
            select: () => ({ eq: () => ({ single: async () => ({ data: { stock: 1 }, error: null }) }) }),
          }
        }

        throw new Error(`unexpected table ${table}`)
      },
    })

    const response = await PUT(
      new Request('http://localhost/api/cart/items/i2', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 2 }),
      }),
      { params: Promise.resolve({ id: 'i2' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Insufficient stock' })
  })

  it('PUT updates cart item when ownership and stock checks pass', async () => {
    const { PUT } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-3' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'buyer-3' }),
      fromImpl: (table) => {
        if (table === 'cart_items') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { id: 'i3', product_id: 'p3', carts: { buyer_id: 'buyer-3' } }, error: null }),
              }),
            }),
            update: () => ({
              eq: () => ({
                select: () => ({
                  single: async () => ({ data: { id: 'i3', quantity: 3, gift_packaging: true }, error: null }),
                }),
              }),
            }),
          }
        }

        if (table === 'products') {
          return {
            select: () => ({ eq: () => ({ single: async () => ({ data: { stock: 10 }, error: null }) }) }),
          }
        }

        throw new Error(`unexpected table ${table}`)
      },
    })

    const response = await PUT(
      new Request('http://localhost/api/cart/items/i3', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 3, giftPackaging: true }),
      }),
      { params: Promise.resolve({ id: 'i3' }) }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ message: 'Cart item updated', item: { id: 'i3' } })
  })

  it('DELETE returns 403 when item does not belong to user', async () => {
    const { DELETE } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-4' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'buyer-4' }),
      fromImpl: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { id: 'i4', carts: { buyer_id: 'other-buyer' } }, error: null }),
          }),
        }),
        delete: () => ({ eq: async () => ({ error: null }) }),
      }),
    })

    const response = await DELETE(new Request('http://localhost/api/cart/items/i4', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'i4' }),
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ error: 'Unauthorized' })
  })
})
