import { NextResponse } from 'next/server'
import { supabase as supabaseAdmin } from '@/lib/supabase'
import { sendOtpEmail } from '@/lib/email'

export async function POST(request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 })
    }

    console.log(`Resending OTP verification email to: ${email}`)

    // Check if user exists in the database
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle()

    if (userError || !user) {
      console.warn(`User lookup failed for resend OTP: ${email}`)
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    if (user.is_verified) {
      return NextResponse.json({ success: false, error: 'Email is already verified', alreadyVerified: true }, { status: 400 })
    }

    // Generate 6-digit OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

    // Save OTP to database
    const { error: otpDbError } = await supabaseAdmin
      .from('otps')
      .insert({
        email,
        otp: otpCode,
        user_type: user.user_type,
        expires_at: expiresAt.toISOString(),
        is_used: false
      })

    if (otpDbError) {
      console.error('Failed to create OTP verification record:', otpDbError)
      return NextResponse.json({ success: false, error: 'Failed to generate verification code' }, { status: 500 })
    }

    // Send OTP verification email in background
    sendOtpEmail({
      to: email,
      username: user.name || email.split('@')[0],
      otp: otpCode
    }).then(() => {
      console.log('Resend OTP email sent successfully to:', email)
    }).catch((emailError) => {
      console.error('Failed to send resend OTP email:', emailError)
    })

    return NextResponse.json({ success: true, message: 'Verification code resent successfully' })
  } catch (error) {
    console.error('Resend OTP error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
