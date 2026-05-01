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

  const route = await import('@/app/api/notifications/[id]/route')
  return { ...route, mocks: { requireAuth, getUserBySupabaseAuthId, from } }
}

describe('/api/notifications/[id] route handlers', () => {
  it('PATCH marks a notification as read by default', async () => {
    const updateMock = vi.fn(() => ({
      eq: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
    }))

    const { PATCH } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-1', user_type: 'Buyer' }),
      fromImpl: () => ({ update: updateMock }),
    })

    const response = await PATCH(
      new Request('http://localhost/api/notifications/n1', { method: 'PATCH' }),
      { params: Promise.resolve({ id: 'n1' }) }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ success: true })
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ is_read: true }))
  })

  it('PATCH can mark a notification as unread', async () => {
    const updateMock = vi.fn(() => ({
      eq: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
    }))

    const { PATCH } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-2' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-2', user_type: 'Seller' }),
      fromImpl: () => ({ update: updateMock }),
    })

    const response = await PATCH(
      new Request('http://localhost/api/notifications/n2', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: false }),
      }),
      { params: Promise.resolve({ id: 'n2' }) }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ success: true })
    expect(updateMock).toHaveBeenCalledWith({ is_read: false, read_at: null })
  })

  it('DELETE returns 500 when delete fails', async () => {
    const { DELETE } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-3' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-3', user_type: 'Buyer' }),
      fromImpl: () => ({
        delete: () => ({ eq: () => ({ eq: () => ({ eq: async () => ({ error: { message: 'db fail' } }) }) }) }),
      }),
    })

    const response = await DELETE(new Request('http://localhost/api/notifications/n3', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'n3' }),
    })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ error: 'db fail' })
  })
})
