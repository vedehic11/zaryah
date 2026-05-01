import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}))

vi.mock('@/lib/supabase-client', () => ({
  supabaseClient: {
    from: fromMock,
  },
}))

import { generateUniqueUsername, isUsernameAvailable, isValidUsername } from '@/lib/username-generator'

describe('username generator utilities', () => {
  beforeEach(() => {
    fromMock.mockReset()
  })

  it('generates sanitized username when available', async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: async () => ({ data: [], error: null }),
      }),
    })

    const username = await generateUniqueUsername(' My Fancy Store! ')
    expect(username).toBe('my-fancy-store')
  })

  it('appends counter when base username already exists', async () => {
    let call = 0
    fromMock.mockReturnValue({
      select: () => ({
        eq: async () => {
          call += 1
          if (call === 1) {
            return { data: [{ username: 'my-store' }], error: null }
          }
          return { data: [], error: null }
        },
      }),
    })

    const username = await generateUniqueUsername('My Store')
    expect(username).toBe('my-store-1')
  })

  it('supports short names by adding seller prefix', async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: async () => ({ data: [], error: null }),
      }),
    })

    const username = await generateUniqueUsername('A')
    expect(username.startsWith('seller-a')).toBe(true)
  })

  it('validates username format correctly', () => {
    expect(isValidUsername('good_name-123')).toBe(true)
    expect(isValidUsername('UPPERCASE')).toBe(false)
    expect(isValidUsername('ab')).toBe(false)
    expect(isValidUsername('')).toBe(false)
  })

  it('returns false for availability when username is invalid', async () => {
    const available = await isUsernameAvailable('ab')
    expect(available).toBe(false)
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('returns true for availability when row not found', async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: { code: 'PGRST116' } }),
        }),
      }),
    })

    await expect(isUsernameAvailable('new_seller_1')).resolves.toBe(true)
  })

  it('returns false for availability when existing username is found', async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { username: 'taken-name' }, error: null }),
        }),
      }),
    })

    await expect(isUsernameAvailable('taken-name')).resolves.toBe(false)
  })
})
