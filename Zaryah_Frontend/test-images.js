const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

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

  if (!url || !key) {
    console.error('Supabase env vars missing', { url: !!url, key: !!key })
    process.exit(1)
  }

  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  console.log('--- FETCHING RECENT USER PROFILE PHOTOS ---')
  const { data: users, error: userError } = await client
    .from('users')
    .select('id, name, email, profile_photo, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  if (userError) {
    console.error('User fetch error:', userError)
  } else {
    users.forEach(u => {
      console.log(`User: ${u.name} (${u.email}) - Photo: ${u.profile_photo} - Created: ${u.created_at}`)
    })
  }

  console.log('\n--- FETCHING RECENT PRODUCT PHOTOS ---')
  const { data: products, error: prodError } = await client
    .from('products')
    .select('id, name, images, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  if (prodError) {
    console.error('Product fetch error:', prodError)
  } else {
    products.forEach(p => {
      console.log(`Product: ${p.name} - Images: ${JSON.stringify(p.images)} - Created: ${p.created_at}`)
    })
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error.message)
  process.exit(1)
})
