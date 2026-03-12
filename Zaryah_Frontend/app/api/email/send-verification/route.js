import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendVerificationEmail } from '@/lib/email';
import crypto from 'crypto';
import { requireAuth, requireRole } from '@/lib/auth';

export async function POST(request) {
  try {
    const { email, userId, username } = await request.json();

    const session = await requireAuth(request)

    if (!email || !userId) {
      return NextResponse.json(
        { error: 'Email and userId are required' },
        { status: 400 }
      );
    }

    if (session.user.id !== userId) {
      try {
        await requireRole(request, 'Admin')
      } catch (authError) {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        )
      }
    }

    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Save verification token to database
    const { data: verification, error: dbError } = await supabase
      .from('email_verifications')
      .insert({
        user_id: userId,
        token,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to create verification record' },
        { status: 500 }
      );
    }

    // Create verification URL
    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/email/verify?token=${token}`;

    // Send verification email
    try {
      await sendVerificationEmail({
        to: email,
        username: username || email.split('@')[0],
        verificationUrl,
      });

      return NextResponse.json({ 
        message: 'Verification email sent successfully',
        verificationId: verification.id 
      });
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      return NextResponse.json(
        { error: 'Failed to send verification email. Please check your email configuration.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Verification email error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
