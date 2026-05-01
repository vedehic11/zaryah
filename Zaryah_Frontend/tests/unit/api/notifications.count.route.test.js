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

  const route = await import('@/app/api/notifications/count/route')
  return { ...route, mocks: { requireAuth, getUserBySupabaseAuthId, from } }
}

describe('/api/notifications/count GET', () => {
  it('returns 401 when auth throws', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => {
        throw new Error('Unauthorized')
      },
      getUserBySupabaseAuthIdImpl: async () => null,
      fromImpl: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ eq: async () => ({ count: 0, error: null }) }) }) }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/notifications/count'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: 'Unauthorized' })
  })

  it('returns 404 when user lookup fails', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => null,
      fromImpl: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ eq: async () => ({ count: 0, error: null }) }) }) }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/notifications/count'))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ error: 'User not found' })
  })

  it('returns unread count for the user', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-2' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-2', user_type: 'Buyer' }),
      fromImpl: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: async () => ({ count: 7, error: null }),
            }),
          }),
        }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/notifications/count'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ unreadCount: 7 })
  })
})
