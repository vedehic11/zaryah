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

  const route = await import('@/app/api/products/[id]/unarchive/route')
  return { ...route, mocks: { requireAuth, getUserBySupabaseAuthId, from } }
}

describe('/api/products/[id]/unarchive route', () => {
  it('POST restores an archived product for the owner', async () => {
    const productSelectEq = vi.fn(() => ({ single: async () => ({ data: { seller_id: 'seller-1' }, error: null }) }))
    const productUpdateEq = vi.fn(() => ({
      select: () => ({
        single: async () => ({
          data: { id: '11111111-1111-1111-1111-111111111111', archived: false },
          error: null,
        }),
      }),
    }))

    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'seller-1', user_type: 'Seller' }),
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
    const response = await POST(
      new Request('http://localhost/api/products/123/unarchive', { method: 'POST' }),
      { params: Promise.resolve({ id }) }
    )

    const payload = await response.json()
    expect(response.status).toBe(200)
    expect(payload.message).toContain('restored successfully')
    expect(payload.product.archived).toBe(false)
    expect(productSelectEq).toHaveBeenCalledWith('id', id)
    expect(productUpdateEq).toHaveBeenCalledWith('id', id)
  })

  it('POST forbids unarchive for non-owner non-admin', async () => {
    const productSelectEq = vi.fn(() => ({ single: async () => ({ data: { seller_id: 'seller-1' }, error: null }) }))

    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'seller-2', user_type: 'Seller' }),
      fromImpl: (table) => {
        if (table === 'products') {
          return {
            select: () => ({ eq: productSelectEq }),
            update: () => ({ eq: vi.fn() }),
          }
        }

        throw new Error(`unexpected table ${table}`)
      },
    })

    const response = await POST(
      new Request('http://localhost/api/products/123/unarchive', { method: 'POST' }),
      { params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }) }
    )

    const payload = await response.json()
    expect(response.status).toBe(403)
    expect(payload.error).toContain('Forbidden')
  })
})
