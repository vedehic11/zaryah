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

  const route = await import('@/app/api/support/tickets/[id]/messages/route')
  return { ...route, mocks: { requireAuth, getUserBySupabaseAuthId, from } }
}

describe('/api/support/tickets/[id]/messages route handlers', () => {
  it('GET returns 500 when auth fails in catch path', async () => {
    const { GET } = await loadRoute({
      requireAuthImpl: async () => {
        throw new Error('Unauthorized')
      },
      getUserBySupabaseAuthIdImpl: async () => null,
      fromImpl: () => ({
        select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/support/tickets/t1/messages'), {
      params: Promise.resolve({ id: 't1' }),
    })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ error: 'Internal server error' })
  })

  it('GET marks unread counterpart messages as read', async () => {
    const inMock = vi.fn(async () => ({ data: null, error: null }))

    const messages = [
      { id: 'm1', is_admin: true, is_read: false },
      { id: 'm2', is_admin: false, is_read: false },
    ]

    const { GET } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-1', user_type: 'Buyer' }),
      fromImpl: (table) => {
        if (table === 'support_ticket_messages') {
          return {
            select: () => ({ eq: () => ({ order: async () => ({ data: messages, error: null }) }) }),
            update: () => ({ in: inMock }),
          }
        }
        throw new Error(`unexpected table ${table}`)
      },
    })

    const response = await GET(new Request('http://localhost/api/support/tickets/t1/messages'), {
      params: Promise.resolve({ id: 't1' }),
    })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.length).toBe(2)
    expect(inMock).toHaveBeenCalledWith('id', ['m1'])
  })

  it('POST returns 400 for empty message', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-2' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-2', user_type: 'Buyer' }),
      fromImpl: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: { id: 't1', user_id: 'user-2', seller_id: 's1' }, error: null }) }) }),
      }),
    })

    const response = await POST(
      new Request('http://localhost/api/support/tickets/t1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '   ' }),
      }),
      { params: Promise.resolve({ id: 't1' }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Message is required' })
  })

  it('POST denies access for non-participant non-admin user', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-3' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'user-x', user_type: 'Buyer' }),
      fromImpl: (table) => {
        if (table === 'support_tickets') {
          return { select: () => ({ eq: () => ({ single: async () => ({ data: { id: 't1', user_id: 'user-a', seller_id: 'seller-a' }, error: null }) }) }) }
        }
        if (table === 'support_ticket_messages') {
          return { insert: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }) }
        }
        throw new Error(`unexpected table ${table}`)
      },
    })

    const response = await POST(
      new Request('http://localhost/api/support/tickets/t1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'hello' }),
      }),
      { params: Promise.resolve({ id: 't1' }) }
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ error: 'Access denied' })
  })

  it('POST creates message for admin and updates ticket timestamp', async () => {
    const updateEqMock = vi.fn(async () => ({ data: null, error: null }))

    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-admin' } }),
      getUserBySupabaseAuthIdImpl: async () => ({ id: 'admin-1', user_type: 'Admin' }),
      fromImpl: (table) => {
        if (table === 'support_tickets') {
          return {
            select: () => ({ eq: () => ({ single: async () => ({ data: { id: 't1', user_id: 'user-a', seller_id: 'seller-a' }, error: null }) }) }),
            update: () => ({ eq: updateEqMock }),
          }
        }

        if (table === 'support_ticket_messages') {
          return {
            insert: () => ({
              select: () => ({ single: async () => ({ data: { id: 'm1', message: 'hello' }, error: null }) }),
            }),
          }
        }

        throw new Error(`unexpected table ${table}`)
      },
    })

    const response = await POST(
      new Request('http://localhost/api/support/tickets/t1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'hello' }),
      }),
      { params: Promise.resolve({ id: 't1' }) }
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({ id: 'm1' })
    expect(updateEqMock).toHaveBeenCalledWith('id', 't1')
  })
})
