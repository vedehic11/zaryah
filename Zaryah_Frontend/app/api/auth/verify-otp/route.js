import { NextResponse } from 'next/server'
import { supabase as supabaseAdmin } from '@/lib/supabase'

export async function POST(request) {
  try {
    const { email, otp } = await request.json()

    if (!email || !otp) {
      return NextResponse.json({ success: false, error: 'Email and OTP are required' }, { status: 400 })
    }

    console.log(`Verifying OTP for: ${email}`)

    // 1. Find the latest active OTP for the email
    const { data: otpRecord, error: otpError } = await supabaseAdmin
      .from('otps')
      .select('*')
      .eq('email', email)
      .eq('otp', otp.trim())
      .eq('is_used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (otpError || !otpRecord) {
      console.warn(`Invalid OTP attempted for ${email}: ${otp}`)
      return NextResponse.json({ success: false, error: 'Invalid verification code' }, { status: 400 })
    }

    // 2. Check if expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      console.warn(`Expired OTP attempted for ${email}: ${otp}`)
      return NextResponse.json({ success: false, error: 'Verification code has expired' }, { status: 400 })
    }

    // 3. Mark OTP as used
    const { error: otpUpdateError } = await supabaseAdmin
      .from('otps')
      .update({ is_used: true })
      .eq('id', otpRecord.id)

    if (otpUpdateError) {
      console.error('Failed to update OTP status:', otpUpdateError)
    }

    // 4. Update the user in the database to is_verified = true
    const { error: userUpdateError } = await supabaseAdmin
      .from('users')
      .update({ is_verified: true })
      .eq('email', email)

    if (userUpdateError) {
      console.error('Failed to update user verification status:', userUpdateError)
      return NextResponse.json({ success: false, error: 'Failed to update user verification status' }, { status: 500 })
    }

    console.log(`Successfully verified email: ${email}`)
    return NextResponse.json({ success: true, message: 'Email verified successfully' })
  } catch (error) {
    console.error('OTP verification error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
