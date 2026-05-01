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

  const route = await import('@/app/api/buyers/route')
  return { ...route, mocks: { requireAuth, getUserBySupabaseAuthId, from } }
}

describe('/api/buyers POST', () => {
  it('returns 401 when userId missing and auth fails', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => null,
      getUserBySupabaseAuthIdImpl: async () => null,
      fromImpl: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        insert: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }),
      }),
    })

    const response = await POST(
      new Request('http://localhost/api/buyers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: 'Mumbai' }),
      })
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: 'Unauthorized - userId required or valid session' })
  })

  it('returns success message when buyer already exists', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'u1' }),
      fromImpl: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { id: 'u1' }, error: null }),
          }),
        }),
      }),
    })

    const response = await POST(
      new Request('http://localhost/api/buyers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: 'Mumbai' }),
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      message: 'Buyer record already exists',
      buyer: { id: 'u1' },
    })
  })

  it('creates buyer record when none exists', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-2' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'u2' }),
      fromImpl: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
            single: async () => ({ data: { id: 'u2' }, error: null }),
          }),
        }),
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { id: 'u2', city: 'Pune' }, error: null }),
          }),
        }),
      }),
    })

    const response = await POST(
      new Request('http://localhost/api/buyers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: 'Pune', address: 'A', state: 'MH', pincode: '411001', phone: '99999' }),
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      message: 'Buyer record created successfully',
      buyer: { id: 'u2', city: 'Pune' },
    })
  })
})
