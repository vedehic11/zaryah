import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendPasswordResetEmail } from '@/lib/email'

function normalizeAbsoluteBaseUrl(value) {
  const raw = String(value || '').trim().replace(/\/$/, '')
  if (!raw) return null

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`

  try {
    const parsed = new URL(withProtocol)
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return null
  }
}

function getAppBaseUrl(request) {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.SITE_URL ||
    ''

  if (configured) {
    const normalizedConfigured = normalizeAbsoluteBaseUrl(configured)
    if (normalizedConfigured) {
      return normalizedConfigured
    }
    console.warn('Invalid configured app URL for reset links:', configured)
  }

  const forwardedProto = request.headers.get('x-forwarded-proto')
  const forwardedHost = request.headers.get('x-forwarded-host')

  if (forwardedProto && forwardedHost) {
    const normalizedForwarded = normalizeAbsoluteBaseUrl(`${forwardedProto}://${forwardedHost}`)
    if (normalizedForwarded) {
      return normalizedForwarded
    }
  }

  return normalizeAbsoluteBaseUrl(request.nextUrl.origin) || 'http://localhost:3000'
}

// POST /api/auth/send-reset-link
// Body: { email, redirectTo? }
export async function POST(request) {
  try {
    const { email } = await request.json()

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }

    const appBaseUrl = getAppBaseUrl(request)
    const finalRedirectTo = `${appBaseUrl}/reset-password`

    // Generate recovery link from Supabase admin API
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: finalRedirectTo,
      },
    })

    if (error) {
      console.error('generateLink error:', error)
      return NextResponse.json({ error: 'Failed to generate reset link' }, { status: 500 })
    }

    const resetUrl = data?.properties?.action_link

    if (!resetUrl) {
      return NextResponse.json({ error: 'Reset link not generated' }, { status: 500 })
    }

    // Send via app SMTP
    await sendPasswordResetEmail({ to: email, resetUrl })

    return NextResponse.json({ success: true, message: 'Password reset link sent' })
  } catch (error) {
    console.error('send-reset-link error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
