import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockSupabaseAdmin = {
  from: vi.fn(),
  auth: {
    admin: {
      deleteUser: vi.fn(),
    }
  }
}

const mockSupabase = {
  from: vi.fn()
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseAdmin)
}))

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}))

const mockSendVerificationEmail = vi.fn()
const mockSendOtpEmail = vi.fn()
vi.mock('@/lib/email', () => ({
  sendVerificationEmail: (...args) => mockSendVerificationEmail(...args),
  sendOtpEmail: (...args) => mockSendOtpEmail(...args)
}))

vi.mock('@/lib/server-url', () => ({
  getServerBaseUrl: vi.fn(() => 'http://localhost')
}))

function createMockChain(returnValue) {
  const chain = {}
  const methods = ['select', 'eq', 'single', 'maybeSingle', 'insert', 'update', 'delete', 'or', 'ilike', 'limit', 'order']
  methods.forEach(method => {
    chain[method] = vi.fn().mockReturnValue(chain)
  })
  chain.then = (onFulfilled) => Promise.resolve(returnValue).then(onFulfilled)
  return chain
}

describe('Register and Verification API Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('Register API (POST)', () => {
    it('successfully registers a buyer with is_verified = false and triggers OTP email', async () => {
      const { POST } = await import('@/app/api/auth/register/route')

      // Mock database calls for register
      // 1. Check if user already exists
      const checkUserChain = createMockChain({ data: null, error: null })
      // 2. Insert new user with is_verified: false
      const insertUserChain = createMockChain({
        data: {
          id: 'buyer-user-id',
          email: 'buyer@example.com',
          name: 'Jane Doe',
          user_type: 'Buyer',
          is_verified: false,
          is_approved: true,
          supabase_auth_id: 'supabase-auth-1'
        },
        error: null
      })
      // 3. Check/Insert buyer record
      const checkBuyerChain = createMockChain({ data: null, error: null })
      const insertBuyerChain = createMockChain({ data: { id: 'buyer-user-id' }, error: null })
      // 4. Save OTP record
      const insertOtpChain = createMockChain({ data: {}, error: null })

      let callCount = 0
      mockSupabaseAdmin.from.mockImplementation((table) => {
        if (table === 'users') {
          callCount++
          return callCount === 1 ? checkUserChain : insertUserChain
        }
        if (table === 'buyers') {
          return checkBuyerChain
        }
        if (table === 'otps') {
          return insertOtpChain
        }
        return createMockChain({ data: null, error: null })
      })

      mockSendOtpEmail.mockResolvedValue(true)

      const request = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'supabase-auth-1',
          email: 'buyer@example.com',
          name: 'Jane Doe',
          userType: 'buyer',
          address: {
            city: 'Mumbai',
            address: '123 Main St',
            state: 'Maharashtra',
            pincode: '400001',
            phone: '1234567890'
          }
        })
      })

      const response = await POST(request)
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(payload.requiresOtp).toBe(true)
      expect(payload.email).toBe('buyer@example.com')
      expect(mockSendOtpEmail).toHaveBeenCalledTimes(1)
      expect(mockSendOtpEmail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'buyer@example.com',
        username: 'Jane Doe',
        otp: expect.stringMatching(/^\d{6}$/)
      }))
    })

    it('successfully registers a seller with is_verified = false and triggers verification link email', async () => {
      const { POST } = await import('@/app/api/auth/register/route')

      // Mock database calls for register
      const checkUserChain = createMockChain({ data: null, error: null })
      const insertUserChain = createMockChain({
        data: {
          id: 'seller-user-id',
          email: 'seller@example.com',
          name: 'Bob Ross',
          user_type: 'Seller',
          is_verified: false,
          is_approved: true,
          supabase_auth_id: 'supabase-auth-2'
        },
        error: null
      })
      const checkSellerChain = createMockChain({ data: null, error: null })
      const insertSellerChain = createMockChain({ data: { id: 'seller-user-id' }, error: null })
      const insertLinkChain = createMockChain({ data: {}, error: null })

      let callCount = 0
      mockSupabaseAdmin.from.mockImplementation((table) => {
        if (table === 'users') {
          callCount++
          return callCount === 1 ? checkUserChain : insertUserChain
        }
        if (table === 'sellers') {
          return checkSellerChain
        }
        if (table === 'email_verifications') {
          return insertLinkChain
        }
        return createMockChain({ data: null, error: null })
      })

      mockSendVerificationEmail.mockResolvedValue(true)

      const request = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'supabase-auth-2',
          email: 'seller@example.com',
          name: 'Bob Ross',
          userType: 'seller',
          address: {
            city: 'Mumbai',
            address: '123 Main St',
            state: 'Maharashtra',
            pincode: '400001',
            phone: '1234567890'
          },
          businessInfo: {
            businessName: 'Happy Trees',
            description: 'Painting stuff',
            username: 'bobross'
          }
        })
      })

      const response = await POST(request)
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(payload.requiresVerification).toBe(true)
      expect(mockSendVerificationEmail).toHaveBeenCalledTimes(1)
      expect(mockSendVerificationEmail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'seller@example.com',
        username: 'Bob Ross',
        verificationUrl: expect.stringContaining('/api/email/verify?token=')
      }))
    })
  })

  describe('Verify API (GET) - Link Verification', () => {
    it('redirects to error when token is missing', async () => {
      const { GET } = await import('@/app/api/email/verify/route')

      const request = new Request('http://localhost/api/email/verify')
      const response = await GET(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost/login?error=invalid_token')
    })

    it('successfully verifies a user and redirects to login with success message', async () => {
      const { GET } = await import('@/app/api/email/verify/route')

      // Mock database calls for verification
      const findTokenChain = createMockChain({
        data: {
          id: 'verification-id',
          user_id: 'user-id-123',
          token: 'valid-token-xyz',
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          verified_at: null
        },
        error: null
      })
      const updateTokenChain = createMockChain({ data: {}, error: null })
      const updateUserChain = createMockChain({ data: {}, error: null })

      let callCount = 0
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'email_verifications') {
          callCount++
          return callCount === 1 ? findTokenChain : updateTokenChain
        }
        if (table === 'users') {
          return updateUserChain
        }
        return createMockChain({ data: null, error: null })
      })

      const request = new Request('http://localhost/api/email/verify?token=valid-token-xyz')
      const response = await GET(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost/login?message=email_verified')
      
      // Ensure the query updated the users table's is_verified field
      expect(mockSupabase.from).toHaveBeenCalledWith('users')
      expect(updateUserChain.update).toHaveBeenCalledWith({ is_verified: true })
    })
  })

  describe('Verify OTP API (POST) - Buyer Verification', () => {
    it('successfully verifies a buyer and sets user is_verified = true', async () => {
      const { POST } = await import('@/app/api/auth/verify-otp/route')

      const mockOtpRecord = {
        data: {
          id: 'otp-record-id',
          email: 'buyer@example.com',
          otp: '123456',
          expires_at: new Date(Date.now() + 600000).toISOString(),
          is_used: false
        },
        error: null
      }

      const updateOtpChain = createMockChain({ data: {}, error: null })
      const updateUserChain = createMockChain({ data: {}, error: null })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'otps') {
          // Check/Fetch or Update
          return mockSupabase.from.mock.calls.length === 1
            ? createMockChain(mockOtpRecord)
            : updateOtpChain
        }
        if (table === 'users') {
          return updateUserChain
        }
        return createMockChain({ data: null, error: null })
      })

      const request = new Request('http://localhost/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'buyer@example.com',
          otp: '123456'
        })
      })

      const response = await POST(request)
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(payload.message).toContain('verified successfully')
      expect(updateUserChain.update).toHaveBeenCalledWith({ is_verified: true })
    })
  })

  describe('Resend OTP API (POST)', () => {
    it('successfully resends OTP for an unverified user', async () => {
      const { POST } = await import('@/app/api/auth/resend-otp/route')

      const mockUserRecord = {
        data: {
          id: 'user-id-123',
          email: 'buyer@example.com',
          user_type: 'Buyer',
          is_verified: false,
          name: 'Jane Doe'
        },
        error: null
      }

      const insertOtpChain = createMockChain({ data: {}, error: null })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return createMockChain(mockUserRecord)
        }
        if (table === 'otps') {
          return insertOtpChain
        }
        return createMockChain({ data: null, error: null })
      })

      mockSendOtpEmail.mockResolvedValue(true)

      const request = new Request('http://localhost/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'buyer@example.com'
        })
      })

      const response = await POST(request)
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(payload.message).toContain('resent successfully')
      expect(insertOtpChain.insert).toHaveBeenCalledWith(expect.objectContaining({
        email: 'buyer@example.com',
        user_type: 'Buyer',
        otp: expect.stringMatching(/^\d{6}$/)
      }))
      expect(mockSendOtpEmail).toHaveBeenCalledTimes(1)
    })

    it('returns error if user is already verified', async () => {
      const { POST } = await import('@/app/api/auth/resend-otp/route')

      const mockUserRecord = {
        data: {
          id: 'user-id-123',
          email: 'buyer@example.com',
          user_type: 'Buyer',
          is_verified: true,
          name: 'Jane Doe'
        },
        error: null
      }

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return createMockChain(mockUserRecord)
        }
        return createMockChain({ data: null, error: null })
      })

      const request = new Request('http://localhost/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'buyer@example.com'
        })
      })

      const response = await POST(request)
      const payload = await response.json()

      expect(response.status).toBe(400)
      expect(payload.success).toBe(false)
      expect(payload.error).toContain('already verified')
    })
  })
})
