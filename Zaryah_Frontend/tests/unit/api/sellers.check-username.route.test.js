import { describe, expect, it, vi } from 'vitest'

async function loadRoute({ fromImpl }) {
  vi.resetModules()
  const from = vi.fn(fromImpl)

  vi.doMock('@/lib/supabase', () => ({
    supabase: { from },
  }))

  const route = await import('@/app/api/sellers/check-username/route')
  return { ...route, mocks: { from } }
}

describe('/api/sellers/check-username GET', () => {
  it('returns 400 when username is missing', async () => {
    const { GET } = await loadRoute({
      fromImpl: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/sellers/check-username'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Username is required' })
  })

  it('returns 400 for invalid username format', async () => {
    const { GET } = await loadRoute({
      fromImpl: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/sellers/check-username?username=Bad Name'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ available: false, error: 'Invalid username format' })
  })

  it('returns available true when no matching seller exists', async () => {
    const { GET } = await loadRoute({
      fromImpl: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: { code: 'PGRST116' } }),
          }),
        }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/sellers/check-username?username=myshop'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ available: true, username: 'myshop' })
  })

  it('returns available false when username is already taken', async () => {
    const { GET } = await loadRoute({
      fromImpl: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { id: 's1' }, error: null }),
          }),
        }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/sellers/check-username?username=takenname'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ available: false, username: 'takenname' })
  })
})
