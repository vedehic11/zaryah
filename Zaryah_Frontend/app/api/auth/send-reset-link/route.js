import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendPasswordResetEmail } from '@/lib/email'
import { getServerBaseUrl } from '@/lib/server-url'

// POST /api/auth/send-reset-link
// Body: { email, redirectTo? }
export async function POST(request) {
  try {
    const { email } = await request.json()

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }

    const appBaseUrl = getServerBaseUrl(request)
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
