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

  const route = await import('@/app/api/orders/[id]/route')
  return { ...route, mocks: { requireAuth, getUserBySupabaseAuthId, from } }
}

describe('/api/orders/[id] route handlers', () => {
  it('PATCH returns 401 when auth fails', async () => {
    const { PATCH } = await loadRoute({
      requireAuthImpl: async () => {
        throw new Error('Unauthorized')
      },
      getUserBySupabaseAuthIdImpl: async () => null,
      fromImpl: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
      }),
    })

    const response = await PATCH(
      new Request('http://localhost/api/orders/o1', { method: 'PATCH', body: JSON.stringify({ notes: 'x' }) }),
      { params: Promise.resolve({ id: 'o1' }) }
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: 'Unauthorized' })
  })

  it('PATCH returns 403 when user is not owner/admin', async () => {
    const { PATCH } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'u1', user_type: 'Buyer' }),
      fromImpl: (table) => {
        if (table === 'orders') {
          return {
            select: () => ({ eq: () => ({ single: async () => ({ data: { buyer_id: 'other', seller_id: 'seller' }, error: null }) }) }),
            update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }) }),
          }
        }
        throw new Error('unexpected table')
      },
    })

    const response = await PATCH(
      new Request('http://localhost/api/orders/o1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'x' }),
      }),
      { params: Promise.resolve({ id: 'o1' }) }
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ error: 'Forbidden' })
  })

  it('PATCH returns 400 when no allowed fields provided', async () => {
    const { PATCH } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'buyer-1', user_type: 'Buyer' }),
      fromImpl: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: { buyer_id: 'buyer-1', seller_id: 'seller-1' }, error: null }) }) }),
        update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }) }),
      }),
    })

    const response = await PATCH(
      new Request('http://localhost/api/orders/o1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid_field: true }),
      }),
      { params: Promise.resolve({ id: 'o1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'No valid fields to update' })
  })

  it('PUT returns 400 for invalid status values', async () => {
    const { PUT } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-2' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'buyer-1', user_type: 'Buyer' }),
      fromImpl: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
      }),
    })

    const response = await PUT(
      new Request('http://localhost/api/orders/o1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'random' }),
      }),
      { params: Promise.resolve({ id: 'o1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Invalid status' })
  })

  it('PUT blocks buyer from changing to non-cancelled status', async () => {
    const { PUT } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-3' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'buyer-1', user_type: 'Buyer' }),
      fromImpl: (table) => {
        if (table === 'orders') {
          return {
            select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'o1', buyer_id: 'buyer-1', seller_id: 's1', status: 'pending' }, error: null }) }) }),
            update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }) }),
          }
        }
        throw new Error('unexpected table')
      },
    })

    const response = await PUT(
      new Request('http://localhost/api/orders/o1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      }),
      { params: Promise.resolve({ id: 'o1' }) }
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ error: 'Forbidden - Buyers can only cancel orders' })
  })
})
