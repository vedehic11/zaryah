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

  const route = await import('@/app/api/addresses/route')
  return { ...route, mocks: { requireAuth, getUserBySupabaseAuthId, from } }
}

describe('/api/addresses route handlers', () => {
  it('GET returns 401 when auth fails', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => {
        throw new Error('Unauthorized')
      },
      getUserBySupabaseAuthIdImpl: async () => null,
      fromImpl: () => ({
        select: () => ({ eq: () => ({ order: () => ({ order: async () => ({ data: [], error: null }) }) }) }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/addresses'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: 'Unauthorized' })
  })

  it('GET returns 404 when user mapping fails', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => null,
      fromImpl: () => ({
        select: () => ({ eq: () => ({ order: () => ({ order: async () => ({ data: [], error: null }) }) }) }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/addresses'))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ error: 'User not found' })
  })

  it('POST returns 400 for missing required fields', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-2' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-1' }),
      fromImpl: () => ({
        insert: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }),
      }),
    })

    const response = await POST(
      new Request('http://localhost/api/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '', address: '', city: '' }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Missing required fields' })
  })

  it('POST returns 400 for invalid phone number', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-3' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-1' }),
      fromImpl: () => ({
        insert: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }),
      }),
    })

    const response = await POST(
      new Request('http://localhost/api/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Home',
          phone: '12345',
          address: 'Street 1',
          city: 'Mumbai',
          pincode: '400001',
        }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Invalid phone number' })
  })

  it('POST creates address and returns 201', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-4' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-2' }),
      fromImpl: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { id: 'a1', user_id: 'user-2', city: 'Pune' }, error: null }),
          }),
        }),
        update: () => ({ eq: () => ({ eq: async () => ({ data: null, error: null }) }) }),
      }),
    })

    const response = await POST(
      new Request('http://localhost/api/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Office',
          phone: '9876543210',
          address: 'Street 2',
          city: 'Pune',
          state: 'MH',
          pincode: '411001',
          isDefault: true,
        }),
      })
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({ id: 'a1', city: 'Pune' })
  })
})
