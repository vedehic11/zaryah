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

import { GET } from '@/app/api/notifications/count/route'

describe('/api/notifications/count GET', () => {
  beforeEach(() => {
    mockRequireAuth.mockReset()
    mockGetUserBySupabaseAuthId.mockReset()
    mockFrom.mockReset()
  })

  it('returns 401 when auth throws', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    mockGetUserBySupabaseAuthId.mockResolvedValue(null)
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ in: () => ({ eq: async () => ({ count: 0, error: null }) }) }) }),
    })

    const response = await GET(new Request('http://localhost/api/notifications/count'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: 'Unauthorized' })
  })

  it('returns 404 when user lookup fails', async () => {
    mockRequireAuth.mockResolvedValue({ user: { id: 'auth-1' } })
    mockGetUserBySupabaseAuthId.mockResolvedValue(null)
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ in: () => ({ eq: async () => ({ count: 0, error: null }) }) }) }),
    })

    const response = await GET(new Request('http://localhost/api/notifications/count'))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ error: 'User not found' })
  })

  it('returns unread count for the user', async () => {
    mockRequireAuth.mockResolvedValue({ user: { id: 'auth-2' } })
    mockGetUserBySupabaseAuthId.mockResolvedValue({ id: 'user-2', user_type: 'Buyer' })
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          in: () => ({
            eq: async () => ({ count: 7, error: null }),
          }),
        }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/notifications/count'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ unreadCount: 7 })
  })
})
