import { describe, expect, it, vi } from 'vitest'

async function loadRoute({ requireAuthImpl, getUserBySupabaseAuthIdImpl, fromImpl }) {
  vi.resetModules()

  const requireAuth = vi.fn(requireAuthImpl || (async () => null))
  const getUserBySupabaseAuthId = vi.fn(getUserBySupabaseAuthIdImpl || (async () => null))
  const from = vi.fn(fromImpl)

  vi.doMock('@/lib/auth', () => ({
    requireAuth,
    getUserBySupabaseAuthId,
  }))

  vi.doMock('@/lib/supabase', () => ({
    supabase: { from },
  }))

  const route = await import('@/app/api/sellers/route')
  return { ...route, mocks: { requireAuth, getUserBySupabaseAuthId, from } }
}

describe('/api/sellers GET', () => {
  it('queries sellers with featured_story equal to true and no null story restriction', async () => {
    const eqCalls = []
    const notCalls = []
    const orCalls = []
    const inCalls = []
    const orderMock = vi.fn(async () => ({ data: [], error: null }))
    const limitMock = vi.fn(() => ({ order: orderMock }))

    const mockQuery = {
      select: vi.fn(() => mockQuery),
      in: vi.fn((field, val) => {
        inCalls.push([field, val])
        return mockQuery
      }),
      or: vi.fn((val) => {
        orCalls.push(val)
        return mockQuery
      }),
      eq: vi.fn((field, val) => {
        eqCalls.push([field, val])
        return mockQuery
      }),
      not: vi.fn((field, op, val) => {
        notCalls.push([field, op, val])
        return mockQuery
      }),
      limit: limitMock,
      order: orderMock,
    }

    const { GET } = await loadRoute({
      fromImpl: (table) => {
        if (table === 'users') {
          return {
            select: () => ({
              eq: () => ({
                eq: async () => ({ data: [{ id: 'u1' }], error: null }),
              }),
            }),
          }
        }
        return mockQuery
      },
    })

    const response = await GET(
      new Request('http://localhost/api/sellers?featured_story=true')
    )

    expect(response.status).toBe(200)
    expect(eqCalls).toContainEqual(['featured_story', true])
    expect(notCalls.length).toBe(0) // verify not('story', 'is', null) is not called
  })
})
