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

  const route = await import('@/app/api/seller-sections/route')
  return { ...route, requireAuth, getUserBySupabaseAuthId, from }
}

describe('/api/seller-sections route handlers', () => {
  it('GET returns 401 when unauthenticated', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => {
        throw new Error('Unauthorized')
      },
      getUserBySupabaseAuthIdImpl: async () => null,
      fromImpl: () => {
        throw new Error('should not query db')
      },
    })

    const response = await GET(new Request('http://localhost/api/seller-sections'))
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.error).toBe('Unauthorized')
  })

  it('GET returns 403 for non-seller user', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'u1', user_type: 'Buyer' }),
      fromImpl: () => {
        throw new Error('should not query db')
      },
    })

    const response = await GET(new Request('http://localhost/api/seller-sections'))
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload.error).toContain('Only sellers')
  })

  it('GET returns empty array when table is missing', async () => {
    const dbQuery = {
      select: () => ({
        eq: () => ({
          order: async () => ({ data: null, error: { code: '42P01', message: 'missing table' } }),
        }),
      }),
    }

    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'seller-1', user_type: 'Seller' }),
      fromImpl: () => dbQuery,
    })

    const response = await GET(new Request('http://localhost/api/seller-sections'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual([])
  })

  it('POST returns 400 when section name is empty', async () => {
    const { POST, from } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'seller-1', user_type: 'Seller' }),
      fromImpl: () => ({
        select: () => ({
          eq: () => ({
            ilike: () => ({
              single: async () => ({ data: null, error: { code: 'PGRST116' } }),
            }),
          }),
        }),
      }),
    })

    const request = new Request('http://localhost/api/seller-sections', {
      method: 'POST',
      body: JSON.stringify({ name: '   ' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toBe('Section name is required')
    expect(from).not.toHaveBeenCalledWith('seller_sections')
  })

  it('POST returns 409 when duplicate section exists', async () => {
    const duplicateCheckQuery = {
      select: () => ({
        eq: () => ({
          ilike: () => ({
            single: async () => ({ data: { id: 'existing-id' }, error: null }),
          }),
        }),
      }),
    }

    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'seller-1', user_type: 'Seller' }),
      fromImpl: () => duplicateCheckQuery,
    })

    const request = new Request('http://localhost/api/seller-sections', {
      method: 'POST',
      body: JSON.stringify({ name: 'Trending Gifts' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(409)
    expect(payload.error).toBe('Section already exists')
  })

  it('DELETE returns 400 when id query param is missing', async () => {
    const { DELETE } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'seller-1', user_type: 'Seller' }),
      fromImpl: () => ({
        delete: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
      }),
    })

    const response = await DELETE(new Request('http://localhost/api/seller-sections'))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toBe('Section id is required')
  })

  it('DELETE returns success when section is deleted', async () => {
    const deleteQuery = {
      delete: () => ({
        eq: () => ({
          eq: async () => ({ error: null }),
        }),
      }),
    }

    const { DELETE } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'seller-1', user_type: 'Seller' }),
      fromImpl: () => deleteQuery,
    })

    const response = await DELETE(new Request('http://localhost/api/seller-sections?id=sec-1'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
  })
})
