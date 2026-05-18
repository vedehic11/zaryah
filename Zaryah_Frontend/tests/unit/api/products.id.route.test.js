import { describe, expect, it, vi } from 'vitest'

async function loadRoute({ requireAuthImpl, getUserBySupabaseAuthIdImpl, fromImpl }) {
  vi.resetModules()

  const requireAuth = vi.fn(requireAuthImpl)
  const getUserBySupabaseAuthId = vi.fn(getUserBySupabaseAuthIdImpl)
  const from = vi.fn(fromImpl)

  vi.doMock('@/lib/supabase', () => ({
    supabase: { from },
  }))

  vi.doMock('@/lib/auth', () => ({
    requireAuth,
    getUserBySupabaseAuthId,
  }))

  const route = await import('@/app/api/products/[id]/route')
  return { ...route, mocks: { requireAuth, getUserBySupabaseAuthId, from } }
}

describe('/api/products/[id] route handlers', () => {
  it('GET returns 400 for invalid product id format', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'x' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'u1', user_type: 'Buyer' }),
      fromImpl: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/products/bad'), { params: Promise.resolve({ id: 'bad' }) })
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toBe('Invalid product id')
  })

  it('PUT returns 403 when non-owner non-admin updates product', async () => {
    const { PUT } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-1', user_type: 'Seller' }),
      fromImpl: (table) => {
        if (table === 'products') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { seller_id: 'other-seller' }, error: null }),
              }),
            }),
            update: () => ({
              eq: () => ({ select: () => ({ single: async () => ({ data: { id: 'p1' }, error: null }) }) }),
            }),
          }
        }
        throw new Error(`unexpected table ${table}`)
      },
    })

    const response = await PUT(
      new Request('http://localhost/api/products/123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated' }),
      }),
      { params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }) }
    )

    const payload = await response.json()
    expect(response.status).toBe(403)
    expect(payload.error).toContain('Forbidden')
  })

  it('DELETE succeeds for admin user', async () => {
    const productSelectEq = vi.fn(() => ({ single: async () => ({ data: { seller_id: 'some-seller' }, error: null }) }))
    const productDeleteEq = vi.fn(async () => ({ error: null }))
    const orderItemsEq = vi.fn(async () => ({ count: 0, error: null }))
    const cartItemsDeleteEq = vi.fn(async () => ({ error: null }))
    const wishlistDeleteEq = vi.fn(async () => ({ error: null }))
    const ratingsDeleteEq = vi.fn(async () => ({ error: null }))
    const reviewsDeleteEq = vi.fn(async () => ({ error: null }))
    const notificationsDeleteEq = vi.fn(async () => ({ error: null }))

    const { DELETE } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-2' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'admin-1', user_type: 'Admin' }),
      fromImpl: (table) => {
        if (table === 'products') {
          return {
            select: () => ({ eq: productSelectEq }),
            delete: () => ({ eq: productDeleteEq }),
          }
        }

        if (table === 'order_items') {
          return { select: () => ({ eq: orderItemsEq }) }
        }

        if (table === 'cart_items') {
          return { delete: () => ({ eq: cartItemsDeleteEq }) }
        }

        if (table === 'wishlist') {
          return { delete: () => ({ eq: wishlistDeleteEq }) }
        }

        if (table === 'product_ratings') {
          return { delete: () => ({ eq: ratingsDeleteEq }) }
        }

        if (table === 'reviews') {
          return { delete: () => ({ eq: reviewsDeleteEq }) }
        }

        if (table === 'notifications') {
          return { delete: () => ({ eq: notificationsDeleteEq }) }
        }

        throw new Error(`unexpected table ${table}`)
      },
    })

    const id = '11111111-1111-1111-1111-111111111111'
    const response = await DELETE(
      new Request('http://localhost/api/products/123', { method: 'DELETE' }),
      { params: Promise.resolve({ id }) }
    )

    const payload = await response.json()
    expect(response.status).toBe(200)
    expect(payload.message).toContain('deleted successfully')
    expect(productSelectEq).toHaveBeenCalledWith('id', id)
    expect(orderItemsEq).toHaveBeenCalledWith('product_id', id)
    expect(cartItemsDeleteEq).toHaveBeenCalledWith('product_id', id)
    expect(wishlistDeleteEq).toHaveBeenCalledWith('product_id', id)
    expect(ratingsDeleteEq).toHaveBeenCalledWith('product_id', id)
    expect(reviewsDeleteEq).toHaveBeenCalledWith('product_id', id)
    expect(notificationsDeleteEq).toHaveBeenCalledWith('related_product_id', id)
    expect(productDeleteEq).toHaveBeenCalledWith('id', id)
  })

  it('DELETE returns 400 when product has existing order items', async () => {
    const productSelectEq = vi.fn(() => ({ single: async () => ({ data: { seller_id: 'some-seller' }, error: null }) }))
    const orderItemsEq = vi.fn(async () => ({ count: 2, error: null }))

    const { DELETE } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-2' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'admin-1', user_type: 'Admin' }),
      fromImpl: (table) => {
        if (table === 'products') {
          return { select: () => ({ eq: productSelectEq }) }
        }

        if (table === 'order_items') {
          return { select: () => ({ eq: orderItemsEq }) }
        }

        return { delete: () => ({ eq: vi.fn(async () => ({ error: null })) }) }
      },
    })

    const response = await DELETE(
      new Request('http://localhost/api/products/123', { method: 'DELETE' }),
      { params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }) }
    )

    const payload = await response.json()
    expect(response.status).toBe(400)
    expect(payload.error).toContain('existing order items')
    expect(orderItemsEq).toHaveBeenCalledWith('product_id', '11111111-1111-1111-1111-111111111111')
  })

  it('DELETE maps foreign key delete failure to a user-friendly error', async () => {
    const productSelectEq = vi.fn(() => ({ single: async () => ({ data: { seller_id: 'some-seller' }, error: null }) }))
    const orderItemsEq = vi.fn(async () => ({ count: 0, error: null }))
    const productDeleteEq = vi.fn(async () => ({ error: {
      message: 'insert or update on table "products" violates foreign key constraint "order_items_product_id_fkey"',
      details: 'Key (id)=(11111111-1111-1111-1111-111111111111) is still referenced from table "order_items".'
    } }))

    const { DELETE } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-2' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'admin-1', user_type: 'Admin' }),
      fromImpl: (table) => {
        if (table === 'products') {
          return {
            select: () => ({ eq: productSelectEq }),
            delete: () => ({ eq: productDeleteEq }),
          }
        }

        if (table === 'order_items') {
          return { select: () => ({ eq: orderItemsEq }) }
        }

        return { delete: () => ({ eq: vi.fn(async () => ({ error: null })) }) }
      },
    })

    const response = await DELETE(
      new Request('http://localhost/api/products/123', { method: 'DELETE' }),
      { params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }) }
    )

    const payload = await response.json()
    expect(response.status).toBe(400)
    expect(payload.error).toContain('order history')
    expect(productDeleteEq).toHaveBeenCalledWith('id', '11111111-1111-1111-1111-111111111111')
  })
})
