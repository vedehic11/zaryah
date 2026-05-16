import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getServerBaseUrl } from '@/lib/server-url';

export async function GET(request) {
  const appUrl = getServerBaseUrl(request)

  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.redirect(
        `${appUrl}/login?error=invalid_token`
      );
    }

    // Find verification record
    const { data: verification, error: findError } = await supabase
      .from('email_verifications')
      .select('*')
      .eq('token', token)
      .single();

    if (findError || !verification) {
      return NextResponse.redirect(
        `${appUrl}/login?error=invalid_token`
      );
    }

    // Check if already verified
    if (verification.verified_at) {
      return NextResponse.redirect(
        `${appUrl}/login?message=already_verified`
      );
    }

    // Check if expired
    if (new Date(verification.expires_at) < new Date()) {
      return NextResponse.redirect(
        `${appUrl}/login?error=token_expired`
      );
    }

    // Mark as verified
    const { error: updateError } = await supabase
      .from('email_verifications')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', verification.id);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.redirect(
        `${appUrl}/login?error=verification_failed`
      );
    }

    // Update user's email_verified status
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ email_verified: true })
      .eq('id', verification.user_id);

    if (userUpdateError) {
      console.error('User update error:', userUpdateError);
    }

    // Redirect to success page
    const appUrl = getServerBaseUrl(request)
    return NextResponse.redirect(
      `${appUrl}/login?message=email_verified`
    );
  } catch (error) {
    console.error('Email verification error:', error);
    const appUrl = getServerBaseUrl(request)
    return NextResponse.redirect(
      `${appUrl}/login?error=verification_failed`
    );
  }
}
