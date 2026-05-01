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

  const route = await import('@/app/api/support/tickets/unread-count/route')
  return { ...route, mocks: { requireAuth, getUserBySupabaseAuthId, from } }
}

describe('/api/support/tickets/unread-count GET', () => {
  it('returns 401 when session has no user', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({}),
      getUserBySupabaseAuthIdImpl: async () => null,
      fromImpl: () => ({
        select: () => ({ eq: async () => ({ data: [], error: null }) }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/support/tickets/unread-count'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: 'Unauthorized' })
  })

  it('returns zero counts when user has no tickets', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-1', user_type: 'Buyer' }),
      fromImpl: (table) => {
        if (table === 'support_tickets') {
          return {
            select: () => ({
              eq: async () => ({ data: [], error: null }),
            }),
          }
        }

        if (table === 'support_ticket_messages') {
          return {
            select: () => ({ in: () => ({ eq: () => ({ eq: async () => ({ data: [], error: null }) }) }) }),
          }
        }

        throw new Error(`unexpected table ${table}`)
      },
    })

    const response = await GET(new Request('http://localhost/api/support/tickets/unread-count'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ unreadCount: 0, unreadByTicket: {} })
  })

  it('returns aggregated unread counts per ticket', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-2' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-2', user_type: 'Buyer' }),
      fromImpl: (table) => {
        if (table === 'support_tickets') {
          return {
            select: () => ({
              eq: async () => ({ data: [{ id: 't1' }, { id: 't2' }], error: null }),
            }),
          }
        }

        if (table === 'support_ticket_messages') {
          return {
            select: () => ({
              in: () => ({
                eq: () => ({
                  eq: async () => ({
                    data: [{ ticket_id: 't1' }, { ticket_id: 't1' }, { ticket_id: 't2' }],
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }

        throw new Error(`unexpected table ${table}`)
      },
    })

    const response = await GET(new Request('http://localhost/api/support/tickets/unread-count'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.unreadCount).toBe(3)
    expect(payload.unreadByTicket).toMatchObject({ t1: 2, t2: 1 })
  })
})
