// Supabase client for client-side operations (browser)
// This uses the public anon key and is safe to use in client components

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? createCookieStorage() : undefined,
    storageKey: 'zaryah-auth-token',
    flowType: 'pkce'
  }
})

function createCookieStorage() {
  const cookieKey = 'zaryah-auth-token'
  const cookieDomain = '.zaryah.in'

  const getCookieValue = (key) => {
    if (typeof document === 'undefined') return null
    const match = document.cookie.match(new RegExp(`(?:^|; )${key}=([^;]*)`))
    return match ? decodeURIComponent(match[1]) : null
  }

  const setCookieValue = (key, value) => {
    if (typeof document === 'undefined') return
    const isSecure = window.location.protocol === 'https:'
    const secureAttr = isSecure ? '; Secure' : ''
    document.cookie = `${key}=${encodeURIComponent(value)}; Path=/; Domain=${cookieDomain}; SameSite=Lax${secureAttr}`
  }

  const removeCookieValue = (key) => {
    if (typeof document === 'undefined') return
    document.cookie = `${key}=; Path=/; Domain=${cookieDomain}; Max-Age=0; SameSite=Lax`
  }

  return {
    getItem(key) {
      if (key !== cookieKey) return null
      return getCookieValue(cookieKey)
    },
    setItem(key, value) {
      if (key !== cookieKey) return
      setCookieValue(cookieKey, value)
    },
    removeItem(key) {
      if (key !== cookieKey) return
      removeCookieValue(cookieKey)
    }
  }
}


