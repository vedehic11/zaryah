import { describe, expect, it, vi } from 'vitest'

async function loadRoute({ fromImpl }) {
  vi.resetModules()
  const from = vi.fn(fromImpl)

  vi.doMock('@/lib/supabase', () => ({
    supabase: { from },
  }))

  const route = await import('@/app/api/sellers/username/check/route')
  return { ...route, mocks: { from } }
}

describe('/api/sellers/username/check GET', () => {
  it('returns 400 with reason missing when username param absent', async () => {
    const { GET } = await loadRoute({
      fromImpl: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/sellers/username/check'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ available: false, reason: 'missing' })
  })

  it('returns reason reserved for reserved usernames', async () => {
    const { GET } = await loadRoute({
      fromImpl: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/sellers/username/check?username=admin'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ available: false, reason: 'reserved' })
  })

  it('returns reason invalid for invalid username format', async () => {
    const { GET } = await loadRoute({
      fromImpl: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/sellers/username/check?username=AA'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ available: false, reason: 'invalid' })
  })

  it('returns available false with reason taken when username exists', async () => {
    const { GET } = await loadRoute({
      fromImpl: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { id: 's1' }, error: null }),
          }),
        }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/sellers/username/check?username=shop1'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ available: false, reason: 'taken' })
  })

  it('returns available true with reason ok when username is free', async () => {
    const { GET } = await loadRoute({
      fromImpl: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    })

    const response = await GET(new Request('http://localhost/api/sellers/username/check?username=shopfree'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ available: true, reason: 'ok' })
  })
})
