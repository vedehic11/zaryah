// Next.js API route for seller operations
import { NextResponse } from 'next/server'
import { requireAuth, requireRole, getUserBySupabaseAuthId } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// GET /api/sellers - Get all approved sellers (public) or seller profile (authenticated)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const sellerId = searchParams.get('id')
    
    // Try to get user, but don't require auth for public seller list
    let user = null
    try {
      const { requireAuth: requireAuthHelper } = await import('@/lib/auth')
      const session = await requireAuthHelper(request)
      if (session?.user) {
        user = await getUserBySupabaseAuthId(session.user.id)
      }
    } catch (error) {
      // Not authenticated - that's okay for public seller list
      user = null
    }

    if (sellerId) {
      // Get specific seller profile
      const { data: seller, error } = await supabase
        .from('sellers')
        .select(`
          *,
          users:id (
            id,
            email,
            name,
            user_type,
            is_verified,
            is_approved,
            profile_photo
          )
        `)
        .eq('id', sellerId)
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }

      // Only admin or the seller themselves can view full profile
      if (user && user.user_type !== 'Admin' && seller.id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      return NextResponse.json(seller)
    } else {
      // Get all sellers
      // Public: only approved sellers
      // Admin: all sellers
      
      // First, get approved user IDs if not admin
      let approvedUserIds = null
      if (!user || user.user_type !== 'Admin') {
        const { data: approvedUsers } = await supabase
          .from('users')
          .select('id')
          .eq('is_approved', true)
          .eq('user_type', 'Seller')
        
        if (approvedUsers && approvedUsers.length > 0) {
          approvedUserIds = approvedUsers.map(u => u.id)
        } else {
          // No approved sellers
          return NextResponse.json([])
        }
      }

      let query = supabase
        .from('sellers')
        .select(`
          id,
          business_name,
          username,
          cover_photo,
          business_description,
          city,
          primary_mobile,
          instagram,
          facebook,
          x,
          linkedin,
          registration_date,
          users:id (
            id,
            name,
            profile_photo,
            is_approved
          )
        `)

      // Filter by approved user IDs if not admin
      if (approvedUserIds) {
        query = query.in('id', approvedUserIds)
      }

      const { data: sellers, error } = await query
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching sellers:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json(sellers || [])
    }
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching sellers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/sellers - Register new seller
export async function POST(request) {
  try {
    const formData = await request.formData()
    
    // Get Supabase Auth user from session
    const { requireAuth: requireAuthHelper } = await import('@/lib/auth')
    const session = await requireAuthHelper(request)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user already exists
    const existingUser = await getUserBySupabaseAuthId(session.user.id)
    if (existingUser && existingUser.user_type !== 'Buyer') {
      return NextResponse.json({ error: 'User already registered as different type' }, { status: 400 })
    }

    // Extract form data
    const sellerData = {
      full_name: formData.get('fullName'),
      email: formData.get('email') || session.user.email,
      business_name: formData.get('businessName'),
      primary_mobile: formData.get('primaryMobile'),
      business_address: formData.get('businessAddress'),
      business_description: formData.get('businessDescription'),
      city: formData.get('city') || 'Mumbai',
      gst_number: formData.get('gstNumber') || null,
      pan_number: formData.get('panNumber') || null,
      id_type: formData.get('idType'),
      id_number: formData.get('idNumber'),
      alternate_mobile: formData.get('alternateMobile') || null,
      account_holder_name: formData.get('accountHolderName'),
      account_number: formData.get('accountNumber'),
      ifsc_code: formData.get('ifscCode'),
      instagram: formData.get('instagram') || null,
      facebook: formData.get('facebook') || null,
      x: formData.get('x') || null,
      linkedin: formData.get('linkedin') || null,
      username: formData.get('username')?.toLowerCase().trim() || null
    }

    // Validate and check username if provided
    if (sellerData.username) {
      const usernameRegex = /^[a-z0-9_-]+$/
      if (!usernameRegex.test(sellerData.username)) {
        return NextResponse.json({ 
          error: 'Username can only contain lowercase letters, numbers, hyphens, and underscores' 
        }, { status: 400 })
      }

      if (sellerData.username.length < 3 || sellerData.username.length > 50) {
        return NextResponse.json({ 
          error: 'Username must be between 3 and 50 characters' 
        }, { status: 400 })
      }

      // Check if username is available
      const { data: existingUsername } = await supabase
        .from('sellers')
        .select('id')
        .eq('username', sellerData.username)
        .single()

      if (existingUsername) {
        return NextResponse.json({ 
          error: 'Username is already taken' 
        }, { status: 400 })
      }
    } else {
      // Generate username from business name if not provided
      const baseUsername = sellerData.business_name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 45)

      let generatedUsername = baseUsername
      let counter = 0
      
      // Check if generated username exists, if so append counter
      while (true) {
        const { data: existing } = await supabase
          .from('sellers')
          .select('id')
          .eq('username', generatedUsername)
          .single()

        if (!existing) break
        
        counter++
        generatedUsername = `${baseUsername}-${counter}`
      }

      sellerData.username = generatedUsername
    }

    // Validate required fields
    const requiredFields = ['full_name', 'business_name', 'primary_mobile', 'business_address', 
                           'business_description', 'id_type', 'id_number', 'account_holder_name', 
                           'account_number', 'ifsc_code']
    const missingFields = requiredFields.filter(field => !sellerData[field])
    
    if (missingFields.length > 0) {
      return NextResponse.json({ 
        error: `Missing required fields: ${missingFields.join(', ')}` 
      }, { status: 400 })
    }

    // Validate at least one social media handle
    if (!sellerData.instagram && !sellerData.facebook && !sellerData.x && !sellerData.linkedin) {
      return NextResponse.json({ 
        error: 'At least one social media handle is required' 
      }, { status: 400 })
    }

    // Upload ID document
    const idDocumentFile = formData.get('idDocument')
    let idDocumentUrl = null
    
    if (idDocumentFile && idDocumentFile instanceof File) {
      // Upload to Supabase Storage or Cloudinary
      const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/upload`, {
        method: 'POST',
        credentials: 'include',
        body: (() => {
          const fd = new FormData()
          fd.append('file', idDocumentFile)
          fd.append('folder', 'seller-documents')
          return fd
        })()
      })
      
      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json()
        idDocumentUrl = uploadData.url
      } else {
        return NextResponse.json({ error: 'Failed to upload ID document' }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: 'ID document is required' }, { status: 400 })
    }

    sellerData.id_document = idDocumentUrl

    // Upload business document (optional)
    const businessDocumentFile = formData.get('businessDocument')
    if (businessDocumentFile && businessDocumentFile instanceof File) {
      const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/upload`, {
        method: 'POST',
        credentials: 'include',
        body: (() => {
          const fd = new FormData()
          fd.append('file', businessDocumentFile)
          fd.append('folder', 'seller-documents')
          return fd
        })()
      })
      
      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json()
        sellerData.business_document = uploadData.url
      }
    }

    // Upload cover photo (optional)
    const coverPhotoFile = formData.get('coverPhoto')
    if (coverPhotoFile && coverPhotoFile instanceof File) {
      const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/upload`, {
        method: 'POST',
        credentials: 'include',
        body: (() => {
          const fd = new FormData()
          fd.append('file', coverPhotoFile)
          fd.append('folder', 'seller-covers')
          return fd
        })()
      })
      
      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json()
        sellerData.cover_photo = uploadData.url
      }
    }

    // Create or update user in Supabase
    let userId
    if (existingUser) {
      // Update existing user to Seller
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          user_type: 'Seller',
          name: sellerData.full_name
        })
        .eq('id', existingUser.id)
        .select()
        .single()

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 })
      }

      userId = updatedUser.id

      // Delete existing buyer record if exists
      await supabase.from('buyers').delete().eq('id', userId)
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          supabase_auth_id: session.user.id,
          email: sellerData.email,
          name: sellerData.full_name,
          user_type: 'Seller',
          is_verified: session.user.email_confirmed_at !== null,
          is_approved: false // Needs admin approval
        })
        .select()
        .single()

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 400 })
      }

      userId = newUser.id
    }

    // Create seller record
    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .insert({
        id: userId,
        ...sellerData
      })
      .select()
      .single()

    if (sellerError) {
      // Rollback user creation
      await supabase.from('users').delete().eq('id', userId)
      return NextResponse.json({ error: sellerError.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      sellerId: seller.id,
      message: 'Seller registered successfully. Waiting for admin approval.'
    }, { status: 201 })
  } catch (error) {
    console.error('Error registering seller:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

