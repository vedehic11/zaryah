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

  const route = await import('@/app/api/support/tickets/[id]/route')
  return { ...route, mocks: { requireAuth, getUserBySupabaseAuthId, from } }
}

describe('/api/support/tickets/[id] PATCH', () => {
  it('returns 401 when session is missing user', async () => {
    const { PATCH } = await loadRoute({
      requireAuthImpl: async () => ({}),
      getUserBySupabaseAuthIdImpl: async () => null,
      fromImpl: () => ({
        update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }) }),
      }),
    })

    const response = await PATCH(
      new Request('http://localhost/api/support/tickets/t1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      }),
      { params: Promise.resolve({ id: 't1' }) }
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: 'Unauthorized' })
  })

  it('returns 403 when non-admin attempts update', async () => {
    const { PATCH } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-2' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-2', user_type: 'Buyer' }),
      fromImpl: () => ({
        update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }) }),
      }),
    })

    const response = await PATCH(
      new Request('http://localhost/api/support/tickets/t2', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' }),
      }),
      { params: Promise.resolve({ id: 't2' }) }
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ error: 'Admin access required' })
  })

  it('updates ticket successfully for admin', async () => {
    const { PATCH } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-3' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'admin-1', user_type: 'Admin' }),
      fromImpl: () => ({
        update: () => ({
          eq: () => ({
            select: () => ({
              single: async () => ({ data: { id: 't3', status: 'in_progress', priority: 'high' }, error: null }),
            }),
          }),
        }),
      }),
    })

    const response = await PATCH(
      new Request('http://localhost/api/support/tickets/t3', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress', priority: 'high' }),
      }),
      { params: Promise.resolve({ id: 't3' }) }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ id: 't3', status: 'in_progress' })
  })
})
