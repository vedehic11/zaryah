import { describe, expect, it, vi } from 'vitest'

async function loadRoute({ requireAuthImpl }) {
  vi.resetModules()

  const requireAuth = vi.fn(requireAuthImpl)

  vi.doMock('@/lib/auth', () => ({
    requireAuth,
  }))

  const route = await import('@/app/api/upload/route')
  return { ...route, mocks: { requireAuth } }
}

function buildRequestWithFormData(entries = []) {
  const formData = new FormData()
  for (const [key, value] of entries) {
    formData.append(key, value)
  }

  return new Request('http://localhost/api/upload', {
    method: 'POST',
    body: formData,
  })
}

describe('/api/upload POST', () => {
  it('returns 401 for unauthenticated request on non-public folder', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => {
        throw new Error('Unauthorized')
      },
    })

    const request = buildRequestWithFormData([
      ['folder', 'general'],
      ['useSupabase', 'false'],
    ])

    const response = await POST(request)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: 'Unauthorized' })
  })

  it('returns 401 for unauthenticated public folder when useSupabase is true', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => {
        throw new Error('Unauthorized')
      },
    })

    const request = buildRequestWithFormData([
      ['folder', 'seller-documents'],
      ['useSupabase', 'true'],
    ])

    const response = await POST(request)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: 'Unauthorized upload target' })
  })

  it('returns 400 when authenticated request has no file', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-1' } }),
    })

    const request = buildRequestWithFormData([
      ['folder', 'general'],
      ['useSupabase', 'false'],
    ])

    const response = await POST(request)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'No file provided' })
  })

  it('returns 400 for invalid mime type', async () => {
    const { POST } = await loadRoute({
      requireAuthImpl: async () => ({ user: { id: 'auth-2' } }),
    })

    const file = new File(['hello'], 'test.txt', { type: 'text/plain' })
    const request = buildRequestWithFormData([
      ['file', file],
      ['folder', 'general'],
      ['useSupabase', 'false'],
    ])

    const response = await POST(request)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Invalid file type. Allowed: JPEG, PNG, WebP, MP4, WebM, PDF' })
  })
})
