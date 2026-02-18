// Supabase client for server-side operations (API routes, server components)
// This uses the service role key and should only be used in server-side code

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🔧 Initializing Supabase client...')
console.log('📍 Supabase URL:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'MISSING')
console.log('🔑 Service Key:', supabaseServiceKey ? `${supabaseServiceKey.substring(0, 20)}...` : 'MISSING')

if (!supabaseUrl || !supabaseServiceKey) {
  const errorMsg = 'Missing Supabase environment variables. Please check your .env file.'
  console.error('❌', errorMsg)
  console.error('Environment check:', {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY
  })
  throw new Error(errorMsg)
}

let supabase
try {
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  console.log('✅ Supabase client initialized successfully')
} catch (error) {
  console.error('❌ Failed to create Supabase client:', error)
  throw error
}

export { supabase }

