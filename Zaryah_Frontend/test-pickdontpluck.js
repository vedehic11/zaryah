const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

// Load env variables
const envContent = fs.readFileSync('.env.local', 'utf8')
const env = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
  if (match) {
    let value = match[2] || ''
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1)
    }
    env[match[1]] = value
  }
})

async function main() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY

  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // Find user / seller for pickdontpluck
  const { data: sellers, error } = await client
    .from('sellers')
    .select('id, business_name, username, cover_photo, users:users!sellers_id_fkey(id, name, email, profile_photo)')
    .in('username', ['pedorasmilesofficial', 'kalyani-resin-jewelry', 'ksira'])

  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Seller pickdontpluck data:', JSON.stringify(sellers, null, 2))
  }
}

main().catch(console.error)
