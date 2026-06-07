import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockSupabaseAdmin = {
  from: vi.fn(),
  auth: {
    admin: {
      deleteUser: vi.fn()
    }
  }
}

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabaseAdmin
}))

const mockRequireRole = vi.fn()
vi.mock('@/lib/auth', () => ({
  requireRole: mockRequireRole
}))

function createMockChain(returnValue) {
  const chain = {}
  const methods = ['select', 'eq', 'single', 'maybeSingle', 'insert', 'update', 'delete', 'in', 'or']
  methods.forEach(method => {
    chain[method] = vi.fn().mockReturnValue(chain)
  })
  chain.then = (onFulfilled) => Promise.resolve(returnValue).then(onFulfilled)
  return chain
}

describe('Admin Sellers Delete API (DELETE)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('fails when user is not admin', async () => {
    mockRequireRole.mockRejectedValue(new Error('Forbidden: Insufficient permissions'))
    const { DELETE } = await import('@/app/api/admin/sellers/[id]/route')

    const request = new Request('http://localhost/api/admin/sellers/seller-123', {
      method: 'DELETE'
    })

    const response = await DELETE(request, { params: { id: 'seller-123' } })
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ error: 'Forbidden: Insufficient permissions' })
  })

  it('successfully deletes seller and all associated records', async () => {
    mockRequireRole.mockResolvedValue({
      user: { id: 'admin-1', user_type: 'Admin' }
    })

    const mockUserRecord = { data: { supabase_auth_id: 'supabase-auth-user-999' }, error: null }
    const mockProducts = { data: [{ id: 'prod-1' }, { id: 'prod-2' }], error: null }

    mockSupabaseAdmin.from.mockImplementation((table) => {
      if (table === 'users') {
        return createMockChain(mockUserRecord)
      }
      if (table === 'products') {
        return createMockChain(mockProducts)
      }
      if (table === 'support_tickets') {
        return createMockChain({ data: [{ id: 'ticket-1' }], error: null })
      }
      return createMockChain({ data: [], error: null })
    })

    mockSupabaseAdmin.auth.admin.deleteUser.mockResolvedValue({ data: {}, error: null })

    const { DELETE } = await import('@/app/api/admin/sellers/[id]/route')

    const request = new Request('http://localhost/api/admin/sellers/seller-123', {
      method: 'DELETE'
    })

    const response = await DELETE(request, { params: { id: 'seller-123' } })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.message).toContain('deleted successfully')

    // Verify Supabase Auth delete user was called
    expect(mockSupabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith('supabase-auth-user-999')
  })
})
