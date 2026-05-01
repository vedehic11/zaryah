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

  const route = await import('@/app/api/notifications/route')
  return { ...route, mocks: { requireAuth, getUserBySupabaseAuthId, from } }
}

describe('/api/notifications route handlers', () => {
  it('GET returns 401 when auth throws', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => {
        throw new Error('Unauthorized')
      },
      getUserBySupabaseAuthIdImpl: async () => null,
      fromImpl: () => ({
        select: () => ({
          eq: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
        }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/notifications'))
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: 'Unauthorized' })
  })

  it('GET returns 404 when mapped user does not exist', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => null,
      fromImpl: () => ({
        select: () => ({
          eq: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
        }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/notifications'))
    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ error: 'User not found' })
  })

  it('GET maps notifications with _id and unreadCount', async () => {
    const rows = [
      { id: 'n1', is_read: false, title: 'A' },
      { id: 'n2', is_read: true, title: 'B' },
    ]

    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-1', user_type: 'Buyer' }),
      fromImpl: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({ data: rows, error: null }),
              }),
            }),
          }),
        }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/notifications'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.unreadCount).toBe(1)
    expect(payload.notifications[0]).toMatchObject({ id: 'n1', _id: 'n1', isRead: false })
  })

  it('PATCH marks unread notifications as read', async () => {
    const eqIsReadMock = vi.fn(async () => ({ error: null }))

    const { PATCH } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-2' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-2', user_type: 'Seller' }),
      fromImpl: () => ({
        update: () => ({
          eq: () => ({
            eq: () => ({
              eq: eqIsReadMock,
            }),
          }),
        }),
      }),
    })

    const response = await PATCH(new Request('http://localhost/api/notifications', { method: 'PATCH' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ success: true })
    expect(eqIsReadMock).toHaveBeenCalledWith('is_read', false)
  })

  it('DELETE returns 500 on supabase error', async () => {
    const { DELETE } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-3' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-3', user_type: 'Buyer' }),
      fromImpl: () => ({
        delete: () => ({
          eq: () => ({
            eq: async () => ({ error: { message: 'db fail' } }),
          }),
        }),
      }),
    })

    const response = await DELETE(new Request('http://localhost/api/notifications', { method: 'DELETE' }))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ error: 'db fail' })
  })
})
