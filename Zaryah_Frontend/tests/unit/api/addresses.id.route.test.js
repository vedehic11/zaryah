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

  const route = await import('@/app/api/addresses/[id]/route')
  return { ...route, mocks: { requireAuth, getUserBySupabaseAuthId, from } }
}

describe('/api/addresses/[id] route handlers', () => {
  it('GET returns 404 when address is not found', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-1' }),
      fromImpl: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: async () => ({ data: null, error: { message: 'not found' } }),
            }),
          }),
        }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/addresses/a1'), {
      params: Promise.resolve({ id: 'a1' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ error: 'not found' })
  })

  it('PUT returns 404 when address does not belong to user', async () => {
    const { PUT } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-2' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-2' }),
      fromImpl: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: { user_id: 'other-user' }, error: null }) }) }),
        update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }) }),
      }),
    })

    const response = await PUT(
      new Request('http://localhost/api/addresses/a1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: 'Delhi' }),
      }),
      { params: Promise.resolve({ id: 'a1' }) }
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ error: 'Address not found' })
  })

  it('PUT updates address and returns updated row', async () => {
    const neqMock = vi.fn(async () => ({ data: null, error: null }))

    const { PUT } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-3' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-3' }),
      fromImpl: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: { user_id: 'user-3' }, error: null }) }) }),
        update: (values) => {
          if (values?.is_default === false) {
            return { eq: () => ({ eq: () => ({ neq: neqMock }) }) }
          }
          return {
            eq: () => ({
              select: () => ({
                single: async () => ({ data: { id: 'a1', city: 'Bengaluru', is_default: true }, error: null }),
              }),
            }),
          }
        },
      }),
    })

    const response = await PUT(
      new Request('http://localhost/api/addresses/a1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: 'Bengaluru', isDefault: true }),
      }),
      { params: Promise.resolve({ id: 'a1' }) }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ id: 'a1', city: 'Bengaluru', is_default: true })
    expect(neqMock).toHaveBeenCalledWith('id', 'a1')
  })

  it('DELETE removes address and returns success', async () => {
    const { DELETE } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-4' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-4' }),
      fromImpl: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: { user_id: 'user-4' }, error: null }) }) }),
        delete: () => ({ eq: async () => ({ error: null }) }),
      }),
    })

    const response = await DELETE(new Request('http://localhost/api/addresses/a1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'a1' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ success: true })
  })
})
