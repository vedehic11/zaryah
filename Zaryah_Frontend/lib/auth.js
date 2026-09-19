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
          const trimmed = cookie.trim()
          if (!trimmed) return acc
          const eqIndex = trimmed.indexOf('=')
          if (eqIndex === -1) return acc
          const key = trimmed.slice(0, eqIndex)
          const value = trimmed.slice(eqIndex + 1)
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
            token = tokenData?.access_token || tokenData?.currentSession?.access_token || tokenData
            console.log('Token extracted from cookie, length:', token?.length)
          } catch (e) {
            // Cookie might not be JSON, try as direct token
            token = decodeURIComponent(cookies[supabaseTokenCookie])
            console.log('Token from raw cookie, length:', token?.length)
          }
        }

        // Fallback for custom client storage cookie
        if (!token) {
          const customCookieKey = 'zaryah-auth-token'
          const chunkKey = `${customCookieKey}.chunks`
          const chunkCount = Number(cookies[chunkKey] ? decodeURIComponent(cookies[chunkKey]) : 0)

          if (chunkCount) {
            let combined = ''
            for (let i = 0; i < chunkCount; i += 1) {
              const part = cookies[`${customCookieKey}.${i}`]
              if (!part) {
                combined = ''
                break
              }
              combined += decodeURIComponent(part)
            }
            if (combined) {
              try {
                const decoded = Buffer.from(combined, 'base64').toString('utf8')
                const tokenData = JSON.parse(decoded)
                token = tokenData?.access_token || tokenData?.currentSession?.access_token || tokenData
                console.log('Token extracted from chunked cookie, length:', token?.length)
              } catch (e) {
                console.error('Failed to parse chunked auth cookie:', e)
              }
            }
          } else if (cookies[customCookieKey]) {
            try {
              const raw = decodeURIComponent(cookies[customCookieKey])
              const tokenData = JSON.parse(raw)
              token = tokenData?.access_token || tokenData?.currentSession?.access_token || tokenData
              console.log('Token extracted from custom cookie, length:', token?.length)
            } catch (e) {
              token = decodeURIComponent(cookies[customCookieKey])
              console.log('Token from raw custom cookie, length:', token?.length)
            }
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
  console.log('Looking up user by supabase_auth_id:', supabaseAuthId)
  // Build query then execute using whatever helper the supabase client/mocks provide
  const query = supabase
    .from('users')
    .select('*')
    .eq('supabase_auth_id', supabaseAuthId)

  let data, error
  if (typeof query.maybeSingle === 'function') {
    ;({ data, error } = await query.maybeSingle())
  } else if (typeof query.single === 'function') {
    ;({ data, error } = await query.single())
  } else if (typeof query.limit === 'function') {
    ;({ data, error } = await query.limit(1))
    if (Array.isArray(data)) data = data[0] || null
  } else {
    // Last resort: attempt to execute and hope for the best
    ;({ data, error } = await query)
    if (Array.isArray(data)) data = data[0] || null
  }

  if (data) {
    console.log('Found user by supabase_auth_id:', { id: data.id, email: data.email, user_type: data.user_type })
    return data
  }

  // Fallback: If project was migrated, lookup user by email from Supabase Auth and re-link
  try {
    const { data: authUserData, error: authErr } = await supabaseAdmin.auth.admin.getUserById(supabaseAuthId)
    const email = authUserData?.user?.email

    if (email) {
      console.log('Attempting email re-link for:', email)
      const { data: userByEmail } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle()

      if (userByEmail) {
        await supabase
          .from('users')
          .update({ supabase_auth_id: supabaseAuthId })
          .eq('id', userByEmail.id)

        userByEmail.supabase_auth_id = supabaseAuthId
        console.log('✅ Successfully re-linked existing user profile to new Auth ID:', email)
        return userByEmail
      }
    }
  } catch (e) {
    console.error('Error re-linking user by email:', e.message)
  }

  console.error('No user found with supabase_auth_id:', supabaseAuthId)
  return null
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
