import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockRequireAuth = vi.fn()
const mockGetUserBySupabaseAuthId = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/auth', () => ({
  requireAuth: (...args) => mockRequireAuth(...args),
  getUserBySupabaseAuthId: (...args) => mockGetUserBySupabaseAuthId(...args),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
  },
}))

import { GET, PATCH, DELETE } from '@/app/api/notifications/route'

describe('/api/notifications route handlers', () => {
  beforeEach(() => {
    mockRequireAuth.mockReset()
    mockGetUserBySupabaseAuthId.mockReset()
    mockFrom.mockReset()
  })

  it('GET returns 401 when auth throws', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    mockGetUserBySupabaseAuthId.mockResolvedValue(null)
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({ in: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/notifications'))
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: 'Unauthorized' })
  })

  it('GET returns 404 when mapped user does not exist', async () => {
    mockRequireAuth.mockResolvedValue({ user: { id: 'auth-1' } })
    mockGetUserBySupabaseAuthId.mockResolvedValue(null)
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({ in: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
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

    mockRequireAuth.mockResolvedValue({ user: { id: 'auth-1' } })
    mockGetUserBySupabaseAuthId.mockResolvedValue({ id: 'user-1', user_type: 'Buyer' })
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          in: () => ({
            order: () => ({
              limit: async () => ({ data: rows, error: null }),
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

    mockRequireAuth.mockResolvedValue({ user: { id: 'auth-2' } })
    mockGetUserBySupabaseAuthId.mockResolvedValue({ id: 'user-2', user_type: 'Seller' })
    mockFrom.mockReturnValue({
      update: () => ({
        eq: () => ({
          in: () => ({
            eq: eqIsReadMock,
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
    mockRequireAuth.mockResolvedValue({ user: { id: 'auth-3' } })
    mockGetUserBySupabaseAuthId.mockResolvedValue({ id: 'user-3', user_type: 'Buyer' })
    mockFrom.mockReturnValue({
      delete: () => ({
        eq: () => ({
          in: async () => ({ error: { message: 'db fail' } }),
        }),
      }),
    })

    const response = await DELETE(new Request('http://localhost/api/notifications', { method: 'DELETE' }))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ error: 'db fail' })
  })
})
