// Authentication helpers for Next.js API routes using Supabase Auth
import { supabase } from './supabase'
import { createClient } from '@supabase/supabase-js'

// Create a Supabase client for server-side operations with service role key
// This bypasses RLS and should only be used in API routes
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

/**
 * Get Supabase session from request headers or cookies
 * @param {Request} request - Next.js request object
 * @returns {Promise<Object|null>} Supabase session or null
 */
async function getSession(request) {
  try {
    // Try to get token from Authorization header first
    const authHeader = request.headers.get('authorization')
    console.log('Auth header present:', !!authHeader)
    let token = null
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '')
      console.log('Token found in Authorization header, length:', token.length)
    } else {
      // Try to get from cookies (Supabase Auth stores session in cookies)
      const cookieHeader = request.headers.get('cookie')
      console.log('Cookie header present:', !!cookieHeader)
      
      if (cookieHeader) {
        // Extract sb-<project-ref>-auth-token from cookies
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=')
          acc[key] = value
          return acc
        }, {})
        
        // Find Supabase auth token cookie
        const supabaseTokenCookie = Object.keys(cookies).find(key => 
          key.includes('sb-') && key.includes('-auth-token')
        )
        
        console.log('Supabase token cookie found:', !!supabaseTokenCookie)
        
        if (supabaseTokenCookie) {
          try {
            const tokenData = JSON.parse(decodeURIComponent(cookies[supabaseTokenCookie]))
            token = tokenData?.access_token || tokenData
            console.log('Token extracted from cookie, length:', token?.length)
          } catch (e) {
            // Cookie might not be JSON, try as direct token
            token = cookies[supabaseTokenCookie]
            console.log('Token from raw cookie, length:', token?.length)
          }
        }
      }
    }
    
    if (!token) {
      console.log('No token found in headers or cookies')
      return null
    }
    
    // Verify the token and get user
    console.log('Verifying token with Supabase...')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    
    if (error) {
      console.error('Token verification error:', error.message)
      return null
    }
    
    if (!user) {
      console.error('No user returned from token verification')
      return null
    }

    console.log('Session verified, user ID:', user.id)
    return { user }
  } catch (error) {
    console.error('Error getting session:', error)
    return null
  }
}

/**
 * Require authentication for API route
 * @param {Request} request - Next.js request object
 * @returns {Promise<Object>} Supabase session
 * @throws {Error} If not authenticated
 */
export async function requireAuth(request) {
  const session = await getSession(request)
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
  return session
}

/**
 * Get user from Supabase by Supabase Auth ID
 * @param {string} supabaseAuthId - Supabase Auth user ID
 * @returns {Promise<Object|null>} User object or null
 */
export async function getUserBySupabaseAuthId(supabaseAuthId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('supabase_auth_id', supabaseAuthId)
    .single()

  if (error || !data) return null
  return data
}

/**
 * Get user from Supabase Auth ID (for backward compatibility)
 * @param {string} authId - Supabase Auth user ID
 * @returns {Promise<Object|null>} User object or null
 */
export async function getUserByAuth0Id(authId) {
  // For backward compatibility, this now uses Supabase Auth ID
  return getUserBySupabaseAuthId(authId)
}

/**
 * Require specific role for API route
 * @param {Request} request - Next.js request object
 * @param {string|string[]} roles - Required role(s)
 * @returns {Promise<Object>} { session, user }
 * @throws {Error} If not authenticated or wrong role
 */
export async function requireRole(request, roles) {
  const session = await requireAuth(request)
  const user = await getUserBySupabaseAuthId(session.user.id)

  if (!user) {
    throw new Error('User not found in database')
  }

  const roleArray = Array.isArray(roles) ? roles : [roles]
  if (!roleArray.includes(user.user_type)) {
    throw new Error('Forbidden: Insufficient permissions')
  }

  return { session, user }
}

/**
 * Check if user has specific role
 * @param {string} supabaseAuthId - Supabase Auth user ID
 * @param {string} role - Role to check
 * @returns {Promise<boolean>}
 */
export async function checkUserRole(supabaseAuthId, role) {
  const user = await getUserBySupabaseAuthId(supabaseAuthId)
  return user?.user_type === role
}

/**
 * Get buyer ID from Supabase session
 * @param {Request} request - Next.js request object
 * @returns {Promise<string|null>} Buyer UUID or null
 */
export async function getBuyerId(request) {
  const session = await requireAuth(request)
  const user = await getUserBySupabaseAuthId(session.user.id)
  
  if (user?.user_type === 'Buyer') {
    const { data: buyer } = await supabase
      .from('buyers')
      .select('id')
      .eq('id', user.id)
      .single()
    return buyer?.id || null
  }
  return null
}

/**
 * Get seller ID from Supabase session
 * @param {Request} request - Next.js request object
 * @returns {Promise<string|null>} Seller UUID or null
 */
export async function getSellerId(request) {
  const session = await requireAuth(request)
  const user = await getUserBySupabaseAuthId(session.user.id)
  
  if (user?.user_type === 'Seller') {
    return user.id
  }
  return null
}
