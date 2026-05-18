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
  const cookieDomain = resolveCookieDomain()
  const chunkKey = `${cookieKey}.chunks`
  const chunkSize = 3800

  function resolveCookieDomain() {
    if (typeof window === 'undefined') return '.zaryah.in'
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') return null
    if (host === 'zaryah.in' || host.endsWith('.zaryah.in')) return '.zaryah.in'
    return null
  }

  const getCookieValue = (key) => {
    if (typeof document === 'undefined') return null
    const match = document.cookie.match(new RegExp(`(?:^|; )${key}=([^;]*)`))
    return match ? decodeURIComponent(match[1]) : null
  }

  const toBase64 = (value) => {
    try {
      return btoa(unescape(encodeURIComponent(value)))
    } catch (error) {
      console.error('Failed to base64 encode cookie value', error)
      return ''
    }
  }

  const fromBase64 = (value) => {
    try {
      return decodeURIComponent(escape(atob(value)))
    } catch (error) {
      console.error('Failed to base64 decode cookie value', error)
      return ''
    }
  }

  const setCookieValue = (key, value) => {
    if (typeof document === 'undefined') return
    const isSecure = window.location.protocol === 'https:'
    const secureAttr = isSecure ? '; Secure' : ''
    const domainAttr = cookieDomain ? `; Domain=${cookieDomain}` : ''
    // Set cookie to expire in 365 days so session persists across browser restarts
    const expiryDate = new Date()
    expiryDate.setTime(expiryDate.getTime() + (365 * 24 * 60 * 60 * 1000))
    const expiresAttr = `; Expires=${expiryDate.toUTCString()}`
    document.cookie = `${key}=${encodeURIComponent(value)}; Path=/${domainAttr}; SameSite=Lax${expiresAttr}${secureAttr}`
  }

  const removeCookieValue = (key) => {
    if (typeof document === 'undefined') return
    const domainAttr = cookieDomain ? `; Domain=${cookieDomain}` : ''
    document.cookie = `${key}=; Path=/${domainAttr}; Max-Age=0; SameSite=Lax`
  }

  return {
    getItem(key) {
      if (key !== cookieKey) return null
      const chunkCount = Number(getCookieValue(chunkKey) || 0)
      if (!chunkCount) return getCookieValue(cookieKey)
      let combined = ''
      for (let i = 0; i < chunkCount; i += 1) {
        const part = getCookieValue(`${cookieKey}.${i}`)
        if (!part) return null
        combined += part
      }
      return fromBase64(combined)
    },
    setItem(key, value) {
      if (key !== cookieKey) return
      const encoded = toBase64(value)
      if (!encoded) return
      const parts = []
      for (let i = 0; i < encoded.length; i += chunkSize) {
        parts.push(encoded.slice(i, i + chunkSize))
      }
      if (parts.length <= 1) {
        setCookieValue(cookieKey, value)
        removeCookieValue(chunkKey)
        return
      }
      setCookieValue(chunkKey, String(parts.length))
      parts.forEach((part, index) => {
        setCookieValue(`${cookieKey}.${index}`, part)
      })
    },
    removeItem(key) {
      if (key !== cookieKey) return
      const chunkCount = Number(getCookieValue(chunkKey) || 0)
      if (chunkCount) {
        for (let i = 0; i < chunkCount; i += 1) {
          removeCookieValue(`${cookieKey}.${i}`)
        }
        removeCookieValue(chunkKey)
      }
      removeCookieValue(cookieKey)
    }
  }
}


