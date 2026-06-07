import { createClient } from '@supabase/supabase-js';
import { sendVerificationEmail, sendOtpEmail } from '@/lib/email';
import crypto from 'crypto';
import { getServerBaseUrl } from '@/lib/server-url';

// Server-side client with service role key to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, email, name, mobile, userType, address, businessInfo } = body;

    console.log('Creating database records for user:', email);

    // Server-side phone validation: ensure any provided phone is exactly 10 digits
    const providedPhone = (mobile || address?.phone || '').toString().trim()
    if (providedPhone && !/^\d{10}$/.test(providedPhone)) {
      console.warn('Invalid phone provided during registration:', providedPhone)
      return Response.json({ success: false, error: 'Invalid phone number. Must be 10 digits.' }, { status: 400 })
    }

    // Server-side username validation for sellers
    if (userType === 'seller') {
      const username = businessInfo?.username;
      if (!username) {
        return Response.json({ success: false, error: 'Username is required for sellers.' }, { status: 400 });
      }
      const usernameRegex = /^[a-z0-9-]+$/;
      if (!usernameRegex.test(username)) {
        return Response.json({ success: false, error: 'Invalid username format. Only lowercase letters, numbers, and hyphens allowed.' }, { status: 400 });
      }
      if (username.length < 3 || username.length > 50) {
        return Response.json({ success: false, error: 'Username must be between 3 and 50 characters.' }, { status: 400 });
      }
    }

    // Check if user already exists by email
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (existingUser) {
      console.log('User already exists:', email);
      return Response.json({ 
        success: false, 
        error: 'Email already registered. Please login instead.',
        alreadyExists: true
      }, { status: 409 });
    }

    // Create user record (matching users table schema)
    const userData = {
      supabase_auth_id: userId,
      email,
      name,
      user_type: userType === 'buyer' ? 'Buyer' : 'Seller',
      is_verified: false,
      is_approved: true // All accounts are approved by default; sellers no longer require manual approval
    };

    const { data: newUser, error: userError } = await supabaseAdmin
      .from('users')
      .insert([userData])
      .select()
      .single();

    if (userError) {
      console.error('Error creating user:', userError);
      
      // Clean up: Delete the auth user since database record creation failed
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        console.log('Cleaned up auth user after database error:', userId);
      } catch (cleanupError) {
        console.error('Failed to cleanup auth user:', cleanupError);
      }
      
      return Response.json(
        { success: false, error: 'Failed to create user record', details: userError },
        { status: 500 }
      );
    }

    console.log('User record created:', newUser.id);

    // Create buyer record if userType is 'buyer' (buyers.id = users.id foreign key)
    if (userType === 'buyer') {
      const { data: existingBuyer } = await supabaseAdmin
        .from('buyers')
        .select('id')
        .eq('id', newUser.id)
        .single();

      if (!existingBuyer) {
        const buyerData = {
          id: newUser.id, // buyers.id references users.id
          city: address?.city || 'Mumbai',
          address: address?.address || '',
          state: address?.state || '',
          pincode: address?.pincode || '',
          phone: mobile || address?.phone || ''
        };

        const { error: buyerError } = await supabaseAdmin
          .from('buyers')
          .insert([buyerData])
          .select();

        if (buyerError) {
          console.error('Error creating buyer:', buyerError);
          
          // Clean up: Delete user record and auth user
          try {
            await supabaseAdmin.from('users').delete().eq('id', newUser.id);
            await supabaseAdmin.auth.admin.deleteUser(userId);
            console.log('Cleaned up user and auth records after buyer creation error');
          } catch (cleanupError) {
            console.error('Failed to cleanup after buyer error:', cleanupError);
          }
          
          return Response.json(
            { success: false, error: 'Failed to create buyer record', details: buyerError },
            { status: 500 }
          );
        }

        console.log('Buyer record created successfully');

        // Create initial delivery address from registration data
        if (address && (address.address || address.city || address.pincode)) {
          const addressData = {
            user_id: newUser.id,
            name: name, // Use buyer's name for the address
            phone: mobile || address.phone || '',
            address: address.address || '',
            city: address.city || 'Mumbai',
            state: address.state || '',
            pincode: address.pincode || '',
            country: 'India',
            is_default: true, // First address is default
            is_active: true
          };

          const { error: addressError } = await supabaseAdmin
            .from('addresses')
            .insert([addressData]);

          if (addressError) {
            console.error('Error creating initial address:', addressError);
            // Don't fail registration if address creation fails
          } else {
            console.log('Initial delivery address created successfully');
          }
        }
      } else {
        console.log('Buyer record already exists');
      }
    }

    // Create seller record if userType is 'seller' (sellers.id = users.id foreign key)
    if (userType === 'seller' && businessInfo) {
      const { data: existingSeller } = await supabaseAdmin
        .from('sellers')
        .select('id')
        .eq('id', newUser.id)
        .single();

      if (!existingSeller) {
        // Normalize id_type to match database constraint
        let normalizedIdType = businessInfo.idType || 'Aadhar Card';
        const idTypeMap = {
          'aadhar': 'Aadhar Card',
          'aadhar card': 'Aadhar Card',
          'pan': 'PAN Card',
          'pan card': 'PAN Card',
          'driving license': 'Driving License',
          'driving_license': 'Driving License',
          'dl': 'Driving License',
          'passport': 'Passport'
        };
        
        if (normalizedIdType) {
          const mapped = idTypeMap[normalizedIdType.toLowerCase()];
          if (mapped) {
            normalizedIdType = mapped;
          } else {
            // If already properly capitalized, keep as is, else default
            const validTypes = ['Aadhar Card', 'PAN Card', 'Driving License', 'Passport'];
            if (!validTypes.includes(normalizedIdType)) {
              normalizedIdType = 'Aadhar Card';
            }
          }
        }
        
        const sellerData = {
          id: newUser.id, // sellers.id references users.id
          full_name: name,
          business_name: businessInfo.businessName || name,
          business_description: businessInfo.description || 'Handcrafted products',
          business_address: address?.address || 'India',
          city: address?.city || 'Mumbai',
          state: address?.state || '',
          pincode: address?.pincode || '',
          primary_mobile: mobile || address?.phone || '',
          username: businessInfo.username || email.split('@')[0],
          account_holder_name: businessInfo.accountHolderName || name,
          upi_id: businessInfo.upiId || 'pending',
          id_type: normalizedIdType,
          id_number: businessInfo.idNumber || 'pending',
          id_document: businessInfo.idDocument || 'pending',
          gst_number: businessInfo.gstNumber || null,
          // Social media fields - at least one required by check constraint
          instagram: businessInfo.instagram || null,
          facebook: businessInfo.facebook || null,
          x: businessInfo.x || businessInfo.twitter || null,
          linkedin: businessInfo.linkedin || null
        };

        console.log('Attempting to create seller with data:', JSON.stringify(sellerData, null, 2));

        const { data: sellerResult, error: sellerError } = await supabaseAdmin
          .from('sellers')
          .insert([sellerData]);

        if (sellerError) {
          console.error('Error creating seller - Full error details:', JSON.stringify(sellerError, null, 2));
          console.error('Error code:', sellerError.code);
          console.error('Error message:', sellerError.message);
          console.error('Error details:', sellerError.details);
          console.error('Error hint:', sellerError.hint);
          
          // Clean up: Delete user record and auth user
          try {
            await supabaseAdmin.from('users').delete().eq('id', newUser.id);
            await supabaseAdmin.auth.admin.deleteUser(userId);
            console.log('Cleaned up user and auth records after seller creation error');
          } catch (cleanupError) {
            console.error('Failed to cleanup after seller error:', cleanupError);
          }
          
          return Response.json(
            { 
              success: false, 
              error: 'Failed to create seller record', 
              details: sellerError,
              message: sellerError.message,
              code: sellerError.code
            },
            { status: 500 }
          );
        }

        console.log('Seller record created successfully');
      } else {
        console.log('Seller record already exists');
      }
    }

    if (newUser.user_type === 'Buyer') {
      // Generate 6-digit OTP code
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Save OTP to database
      const { error: otpDbError } = await supabaseAdmin
        .from('otps')
        .insert({
          email,
          otp: otpCode,
          user_type: 'Buyer',
          expires_at: expiresAt.toISOString(),
          is_used: false
        });

      if (otpDbError) {
        console.error('Failed to create OTP verification record:', otpDbError);
      } else {
        // Send OTP verification email in the background without blocking the response
        sendOtpEmail({
          to: email,
          username: name || email.split('@')[0],
          otp: otpCode
        }).then(() => {
          console.log('OTP email sent successfully to:', email);
        }).catch((emailError) => {
          console.error('Failed to send OTP email during registration:', emailError);
        });
      }

      return Response.json({ 
        success: true, 
        requiresOtp: true,
        email: newUser.email,
        message: 'OTP sent successfully for verification',
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          user_type: newUser.user_type,
          is_verified: false,
          is_approved: newUser.is_approved,
          supabase_auth_id: newUser.supabase_auth_id
        }
      });
    } else {
      // Generate verification link token for Sellers
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Save verification token to database
      const { error: dbError } = await supabaseAdmin
        .from('email_verifications')
        .insert({
          user_id: newUser.id,
          token,
          expires_at: expiresAt.toISOString(),
        });

      if (dbError) {
        console.error('Failed to create verification record:', dbError);
      } else {
        const appUrl = getServerBaseUrl(request);
        const verificationUrl = `${appUrl}/api/email/verify?token=${token}`;

        // Send verification email in the background without blocking the response
        sendVerificationEmail({
          to: email,
          username: name || email.split('@')[0],
          verificationUrl,
        }).then(() => {
          console.log('Verification email sent successfully to:', email);
        }).catch((emailError) => {
          console.error('Failed to send verification email during registration:', emailError);
        });
      }

      return Response.json({ 
        success: true, 
        requiresVerification: true,
        message: 'Verification link sent successfully',
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          user_type: newUser.user_type,
          is_verified: false,
          is_approved: newUser.is_approved,
          supabase_auth_id: newUser.supabase_auth_id
        }
      });
    }

  } catch (error) {
    console.error('Error in register API:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
