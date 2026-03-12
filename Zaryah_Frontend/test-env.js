const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY'
]

const missing = required.filter((key) => !process.env[key])

if (missing.length > 0) {
  console.error('Missing required environment variables:')
  missing.forEach((key) => console.error(`- ${key}`))
  process.exit(1)
}

console.log('Environment variable check passed')
