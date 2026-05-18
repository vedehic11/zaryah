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

  it('DELETE succeeds for admin user and archives product', async () => {
    const productSelectEq = vi.fn(() => ({ single: async () => ({ data: { seller_id: 'some-seller' }, error: null }) }))
    const productUpdateEq = vi.fn(() => ({
      select: () => ({
        single: async () => ({
          data: { id: '11111111-1111-1111-1111-111111111111', archived: true },
          error: null
        })
      })
    }))

    const { DELETE } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-2' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'admin-1', user_type: 'Admin' }),
      fromImpl: (table) => {
        if (table === 'products') {
          return {
            select: () => ({ eq: productSelectEq }),
            update: () => ({ eq: productUpdateEq }),
          }
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
    expect(payload.message).toContain('archived successfully')
    expect(payload.product.archived).toBe(true)
    expect(productSelectEq).toHaveBeenCalledWith('id', id)
    expect(productUpdateEq).toHaveBeenCalledWith('id', id)
  })

  it('DELETE archives product even when it has existing order items', async () => {
    const productSelectEq = vi.fn(() => ({ single: async () => ({ data: { seller_id: 'some-seller' }, error: null }) }))
    const productUpdateEq = vi.fn(() => ({
      select: () => ({
        single: async () => ({
          data: { id: '11111111-1111-1111-1111-111111111111', archived: true },
          error: null
        })
      })
    }))

    const { DELETE } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-2' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'admin-1', user_type: 'Admin' }),
      fromImpl: (table) => {
        if (table === 'products') {
          return {
            select: () => ({ eq: productSelectEq }),
            update: () => ({ eq: productUpdateEq }),
          }
        }

        throw new Error(`unexpected table ${table}`)
      },
    })

    const response = await DELETE(
      new Request('http://localhost/api/products/123', { method: 'DELETE' }),
      { params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }) }
    )

    const payload = await response.json()
    expect(response.status).toBe(200)
    expect(payload.message).toContain('archived successfully')
    expect(payload.product.archived).toBe(true)
  })
})
