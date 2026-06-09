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

import { PATCH, DELETE } from '@/app/api/notifications/[id]/route'

describe('/api/notifications/[id] route handlers', () => {
  beforeEach(() => {
    mockRequireAuth.mockReset()
    mockGetUserBySupabaseAuthId.mockReset()
    mockFrom.mockReset()
  })

  it('PATCH marks a notification as read by default', async () => {
    const updateMock = vi.fn(() => ({
      eq: () => ({ eq: () => ({ in: async () => ({ error: null }) }) }),
    }))

    mockRequireAuth.mockResolvedValue({ user: { id: 'auth-1' } })
    mockGetUserBySupabaseAuthId.mockResolvedValue({ id: 'user-1', user_type: 'Buyer' })
    mockFrom.mockReturnValue({ update: updateMock })

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
      eq: () => ({ eq: () => ({ in: async () => ({ error: null }) }) }),
    }))

    mockRequireAuth.mockResolvedValue({ user: { id: 'auth-2' } })
    mockGetUserBySupabaseAuthId.mockResolvedValue({ id: 'user-2', user_type: 'Seller' })
    mockFrom.mockReturnValue({ update: updateMock })

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
    mockRequireAuth.mockResolvedValue({ user: { id: 'auth-3' } })
    mockGetUserBySupabaseAuthId.mockResolvedValue({ id: 'user-3', user_type: 'Buyer' })
    mockFrom.mockReturnValue({
      delete: () => ({ eq: () => ({ eq: () => ({ in: async () => ({ error: { message: 'db fail' } }) }) }) }),
    })

    const response = await DELETE(new Request('http://localhost/api/notifications/n3', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'n3' }),
    })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ error: 'db fail' })
  })
})
