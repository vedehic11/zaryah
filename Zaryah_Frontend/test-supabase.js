const { createClient } = require('@supabase/supabase-js')

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.error('Supabase env vars missing for connectivity test')
    process.exit(1)
  }

  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const { error } = await client.from('users').select('id', { count: 'exact', head: true })

  if (error) {
    console.error('Supabase connectivity test failed:', error.message)
    process.exit(1)
  }

  console.log('Supabase connectivity test passed')
}

main().catch((error) => {
  console.error('Unexpected test error:', error.message)
  process.exit(1)
})
