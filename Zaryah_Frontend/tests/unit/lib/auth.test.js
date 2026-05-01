import { describe, expect, it, vi } from 'vitest'

async function loadAuthModule({ getUserImpl, fromImpl }) {
  vi.resetModules()

  const getUser = vi.fn(getUserImpl || (async () => ({ data: { user: null }, error: null })))
  const from = vi.fn(fromImpl || (() => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) })))
  const createClient = vi.fn(() => ({ auth: { getUser } }))

  vi.doMock('@supabase/supabase-js', () => ({ createClient }))
  vi.doMock('@/lib/supabase', () => ({ supabase: { from } }))

  const mod = await import('@/lib/auth')
  return { ...mod, mocks: { getUser, from, createClient } }
}

describe('lib/auth helpers', () => {
  it('requireAuth accepts bearer token from authorization header', async () => {
    const { requireAuth, mocks } = await loadAuthModule({
      getUserImpl: async (token) => ({ data: { user: { id: `u-${token}` } }, error: null }),
    })

    const request = new Request('http://localhost/api/test', {
      headers: { authorization: 'Bearer token-123' },
    })

    const session = await requireAuth(request)
    expect(session.user.id).toBe('u-token-123')
    expect(mocks.getUser).toHaveBeenCalledWith('token-123')
  })

  it('requireAuth accepts token from Supabase auth cookie', async () => {
    const tokenData = encodeURIComponent(JSON.stringify({ access_token: 'cookie-token' }))
    const { requireAuth, mocks } = await loadAuthModule({
      getUserImpl: async (token) => ({ data: { user: { id: `cookie-${token}` } }, error: null }),
    })

    const request = new Request('http://localhost/api/test', {
      headers: { cookie: `sb-project-auth-token=${tokenData}` },
    })

    const session = await requireAuth(request)
    expect(session.user.id).toBe('cookie-cookie-token')
    expect(mocks.getUser).toHaveBeenCalledWith('cookie-token')
  })

  it('requireAuth throws Unauthorized when token missing/invalid', async () => {
    const { requireAuth } = await loadAuthModule({
      getUserImpl: async () => ({ data: { user: null }, error: { message: 'bad token' } }),
    })

    await expect(requireAuth(new Request('http://localhost/api/test'))).rejects.toThrow('Unauthorized')
  })

  it('getUserBySupabaseAuthId returns user row', async () => {
    const { getUserBySupabaseAuthId, mocks } = await loadAuthModule({
      fromImpl: (table) => {
        if (table !== 'users') throw new Error('unexpected table')
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { id: 'db-user', user_type: 'Buyer', email: 'x@y.com' }, error: null }),
            }),
          }),
        }
      },
    })

    const user = await getUserBySupabaseAuthId('auth-id')
    expect(user.id).toBe('db-user')
    expect(mocks.from).toHaveBeenCalledWith('users')
  })

  it('requireRole returns session and user when role matches', async () => {
    const { requireRole } = await loadAuthModule({
      getUserImpl: async () => ({ data: { user: { id: 'auth-1' } }, error: null }),
      fromImpl: (table) => {
        if (table === 'users') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { id: 'user-1', user_type: 'Admin' }, error: null }),
              }),
            }),
          }
        }

        throw new Error(`unexpected table ${table}`)
      },
    })

    const request = new Request('http://localhost/api/test', {
      headers: { authorization: 'Bearer valid-token' },
    })

    const result = await requireRole(request, ['Admin', 'Seller'])
    expect(result.user.user_type).toBe('Admin')
    expect(result.session.user.id).toBe('auth-1')
  })

  it('requireRole throws when role does not match', async () => {
    const { requireRole } = await loadAuthModule({
      getUserImpl: async () => ({ data: { user: { id: 'auth-1' } }, error: null }),
      fromImpl: (table) => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { id: 'user-1', user_type: 'Buyer' }, error: null }),
          }),
        }),
      }),
    })

    const request = new Request('http://localhost/api/test', {
      headers: { authorization: 'Bearer valid-token' },
    })

    await expect(requireRole(request, 'Seller')).rejects.toThrow('Forbidden: Insufficient permissions')
  })

  it('getBuyerId returns buyer id for Buyer user', async () => {
    const { getBuyerId } = await loadAuthModule({
      getUserImpl: async () => ({ data: { user: { id: 'auth-1' } }, error: null }),
      fromImpl: (table) => {
        if (table === 'users') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { id: 'buyer-1', user_type: 'Buyer' }, error: null }),
              }),
            }),
          }
        }

        if (table === 'buyers') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { id: 'buyer-1' }, error: null }),
              }),
            }),
          }
        }

        throw new Error(`unexpected table ${table}`)
      },
    })

    const request = new Request('http://localhost/api/test', {
      headers: { authorization: 'Bearer valid-token' },
    })

    await expect(getBuyerId(request)).resolves.toBe('buyer-1')
  })

  it('getSellerId returns seller id for Seller user', async () => {
    const { getSellerId } = await loadAuthModule({
      getUserImpl: async () => ({ data: { user: { id: 'auth-1' } }, error: null }),
      fromImpl: (table) => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { id: 'seller-1', user_type: 'Seller' }, error: null }),
          }),
        }),
      }),
    })

    const request = new Request('http://localhost/api/test', {
      headers: { authorization: 'Bearer valid-token' },
    })

    await expect(getSellerId(request)).resolves.toBe('seller-1')
  })
})
