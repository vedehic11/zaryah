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

  const route = await import('@/app/api/wallet/withdraw/route')
  return { ...route, mocks: { requireAuth, getUserBySupabaseAuthId, from } }
}

describe('/api/wallet/withdraw route handlers', () => {
  it('POST returns 400 for invalid withdrawal amount', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'seller-1', user_type: 'Seller' }),
      fromImpl: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
      }),
    })

    const response = await POST(
      new Request('http://localhost/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 0 }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Invalid withdrawal amount' })
  })

  it('POST returns 400 when available balance is insufficient', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-2' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'seller-2', user_type: 'Seller' }),
      fromImpl: (table) => {
        if (table === 'sellers') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: 'seller-2',
                    account_number: '123456789012',
                    ifsc_code: 'ABCD0123456',
                    account_holder_name: 'Seller Two',
                  },
                  error: null,
                }),
              }),
            }),
          }
        }

        if (table === 'wallets') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { available_balance: 50 }, error: null }),
              }),
            }),
          }
        }

        if (table === 'withdrawal_requests') {
          return {
            select: () => ({
              eq: () => ({ in: async () => ({ data: [], error: null }) }),
            }),
          }
        }

        throw new Error(`unexpected table ${table}`)
      },
    })

    const response = await POST(
      new Request('http://localhost/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 100 }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Insufficient available balance' })
  })

  it('GET returns withdrawals list for seller', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-3' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'seller-3', user_type: 'Seller' }),
      fromImpl: (table) => {
        if (table === 'withdrawal_requests') {
          return {
            select: () => ({
              eq: () => ({
                order: async () => ({ data: [{ id: 'w1', amount: 100 }], error: null }),
              }),
            }),
          }
        }

        throw new Error(`unexpected table ${table}`)
      },
    })

    const response = await GET(new Request('http://localhost/api/wallet/withdraw'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      withdrawals: [{ id: 'w1', amount: 100 }],
    })
  })
})
