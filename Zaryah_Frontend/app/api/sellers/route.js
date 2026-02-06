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
    console.log('\n=== SELLER REGISTRATION START ===')
    console.log('Timestamp:', new Date().toISOString())
    
    const formData = await request.formData()
    console.log('Form data received, entries:', Array.from(formData.entries()).map(([k]) => k))
    
    // Get Supabase Auth user from session
    const { requireAuth: requireAuthHelper } = await import('@/lib/auth')
    let session
    try {
      session = await requireAuthHelper(request)
    } catch (authError) {
      console.log('Auth error:', authError.message)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('Session user:', session?.user?.id)
    if (!session?.user) {
      console.log('No session user found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user already exists
    console.log('Checking for existing user with supabase auth id:', session.user.id)
    const existingUser = await getUserBySupabaseAuthId(session.user.id)
    console.log('Existing user found:', existingUser?.id, 'Type:', existingUser?.user_type)

    // If the user is already a Seller, only block when a seller row exists; allow recovery if seller row is missing
    if (existingUser && existingUser.user_type === 'Seller') {
      const { data: existingSellerForUser } = await supabase
        .from('sellers')
        .select('id')
        .eq('id', existingUser.id)
        .single()

      if (existingSellerForUser) {
        console.log('User already registered as Seller with seller row present')
        return NextResponse.json({ error: 'You are already registered as a seller' }, { status: 400 })
      }

      console.log('User marked as Seller but seller row missing; allowing re-create')
    }
    
    if (existingUser && existingUser.user_type === 'Admin') {
      console.log('Admin cannot register as seller')
      return NextResponse.json({ error: 'Admin accounts cannot register as sellers' }, { status: 400 })
    }

    // Extract form data - normalize field names (backend expects snake_case)
    const fieldMap = {
      'full_name': ['fullName', 'full_name', 'name'],
      'business_name': ['businessName', 'business_name'],
      'primary_mobile': ['primaryMobile', 'primary_mobile', 'phone'],
      'business_address': ['businessAddress', 'business_address'],
      'business_description': ['businessDescription', 'business_description', 'description'],
      'city': ['city'],
      'id_type': ['idType', 'id_type'],
      'id_number': ['idNumber', 'id_number'],
      'account_holder_name': ['accountHolderName', 'account_holder_name'],
      'account_number': ['accountNumber', 'account_number', 'bankAccountNumber'],
      'ifsc_code': ['ifscCode', 'ifsc_code'],
      'username': ['username'],
      'instagram': ['instagram'],
      'facebook': ['facebook'],
      'x': ['x', 'twitter'],
      'linkedin': ['linkedin'],
      'gst_number': ['gstNumber', 'gst_number'],
      'pan_number': ['panNumber', 'pan_number'],
      'alternate_mobile': ['alternateMobile', 'alternate_mobile']
    }
    
    const sellerData = {}
    
    // Extract values, trying multiple field name variations
    Object.entries(fieldMap).forEach(([snakeKey, caseVariations]) => {
      for (const caseVar of caseVariations) {
        const value = formData.get(caseVar)
        if (value && value.trim && value.trim() !== '') {
          sellerData[snakeKey] = value.trim()
          break
        } else if (value && !value.trim) {
          // Non-string value
          sellerData[snakeKey] = value
          break
        }
      }
    })
    
    // Set defaults
    sellerData.city = sellerData.city || 'Mumbai'
    
    // Normalize id_type to match database constraint
    if (sellerData.id_type) {
      const idTypeMap = {
        'aadhar': 'Aadhar Card',
        'aadhar card': 'Aadhar Card',
        'pan': 'PAN Card',
        'pan card': 'PAN Card',
        'driving license': 'Driving License',
        'driving_license': 'Driving License',
        'dl': 'Driving License',
        'passport': 'Passport'
      }
      const normalizedType = idTypeMap[sellerData.id_type.toLowerCase()]
      if (normalizedType) {
        sellerData.id_type = normalizedType
      } else {
        // If already properly capitalized, keep as is
        const validTypes = ['Aadhar Card', 'PAN Card', 'Driving License', 'Passport']
        if (!validTypes.includes(sellerData.id_type)) {
          // Default to Aadhar Card if unrecognized
          sellerData.id_type = 'Aadhar Card'
        }
      }
    }
    
    console.log('Extracted seller data:', Object.keys(sellerData).filter(k => sellerData[k]))
    console.log('Missing seller data:', Object.keys(sellerData).filter(k => !sellerData[k]))

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
    const requiredFields = {
      'full_name': 'Full name',
      'business_name': 'Business name',
      'primary_mobile': 'Primary mobile',
      'business_address': 'Business address',
      'business_description': 'Business description',
      'id_type': 'ID type',
      'id_number': 'ID number',
      'account_holder_name': 'Account holder name',
      'account_number': 'Account number',
      'ifsc_code': 'IFSC code',
      'city': 'City'
    }
    
    const missingFields = []
    Object.entries(requiredFields).forEach(([field, label]) => {
      if (!sellerData[field] || (typeof sellerData[field] === 'string' && sellerData[field].trim() === '')) {
        missingFields.push(label)
      }
    })
    
    if (missingFields.length > 0) {
      console.error('MISSING REQUIRED FIELDS:', {
        missing: missingFields,
        received: Object.keys(sellerData).filter(k => sellerData[k]),
        values: Object.fromEntries(Object.entries(sellerData).map(([k, v]) => [k, v ? 'present' : 'missing']))
      })
      return NextResponse.json({ 
        error: `Missing required fields: ${missingFields.join(', ')}`,
        received: Object.keys(sellerData).filter(k => sellerData[k]),
        missing: missingFields
      }, { status: 400 })
    }

    // Validate at least one social media handle
    if (!sellerData.instagram && !sellerData.facebook && !sellerData.x && !sellerData.linkedin) {
      return NextResponse.json({ 
        error: 'At least one social media handle is required (Instagram, Facebook, X/Twitter, or LinkedIn)' 
      }, { status: 400 })
    }

    // Upload ID document (accepts either File or pre-uploaded URL string)
    const idDocumentValue = formData.get('idDocument') || formData.get('id_document')
    let idDocumentUrl = null
    
    if (idDocumentValue && idDocumentValue instanceof File) {
      // Upload to Supabase Storage or Cloudinary
      const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/upload`, {
        method: 'POST',
        credentials: 'include',
        body: (() => {
          const fd = new FormData()
          fd.append('file', idDocumentValue)
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
    } else if (typeof idDocumentValue === 'string' && idDocumentValue.trim()) {
      // Already uploaded URL provided by client (or placeholder like "pending")
      idDocumentUrl = idDocumentValue.trim()
    } else {
      // Allow placeholder to avoid hard fail; admin can request document later
      idDocumentUrl = 'pending'
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

    // Check if seller record already exists for this user
    const { data: existingSeller } = await supabase
      .from('sellers')
      .select('id')
      .eq('id', userId)
      .single()
    
    console.log('Checking for existing seller record:', existingSeller?.id)
    
    if (existingSeller) {
      console.log('Seller record already exists:', existingSeller.id)
      // If the user row was missing but seller exists, ensure user_type is Seller and name is synced
      await supabase
        .from('users')
        .update({ user_type: 'Seller', name: sellerData.full_name || existingUser?.name })
        .eq('id', userId)
      
      return NextResponse.json({
        success: true,
        sellerId: existingSeller.id,
        message: 'Seller account already registered.'
      }, { status: 200 })
    }

    console.log('Creating seller record with data:', {
      id: userId,
      username: sellerData.username,
      business_name: sellerData.business_name,
      primary_mobile: sellerData.primary_mobile
    })
    
    // Remove any fields that don't belong in sellers table (email is in users table only)
    // Only include valid seller table columns
    const validSellerFields = [
      'full_name', 'business_name', 'username', 'cover_photo', 'primary_mobile',
      'business_address', 'business_description', 'city', 'gst_number', 'pan_number',
      'id_type', 'id_number', 'id_document', 'business_document', 'instagram',
      'facebook', 'x', 'linkedin', 'alternate_mobile', 'account_holder_name',
      'account_number', 'ifsc_code'
    ]
    
    const sellerDataForInsert = {}
    validSellerFields.forEach(field => {
      if (sellerData[field] !== undefined) {
        sellerDataForInsert[field] = sellerData[field]
      }
    })
    
    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .insert({
        id: userId,
        ...sellerDataForInsert
      })
      .select()
      .single()

    if (sellerError) {
      console.log('Seller insertion error:', {
        code: sellerError.code,
        message: sellerError.message,
        details: sellerError.details,
        hint: sellerError.hint
      })
      
      // Rollback user creation if seller creation fails
      await supabase.from('users').delete().eq('id', userId)
      return NextResponse.json({ error: sellerError.message }, { status: 400 })
    }

    console.log('Seller record created successfully:', seller?.id)
    console.log('=== SELLER REGISTRATION SUCCESS ===\n')

    return NextResponse.json({
      success: true,
      sellerId: seller.id,
      message: 'Seller registered successfully. Waiting for admin approval.'
    }, { status: 201 })
  } catch (error) {
    console.error('=== SELLER REGISTRATION ERROR ===')
    console.error('Error type:', error.name)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    console.error('=================================\n')
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 })
  }
}

// PUT /api/sellers - Update seller profile
export async function PUT(request) {
  try {
    const { requireAuth: requireAuthHelper } = await import('@/lib/auth')
    const session = await requireAuthHelper(request)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserBySupabaseAuthId(session.user.id)
    
    if (!user || user.user_type !== 'Seller') {
      return NextResponse.json({ error: 'Only sellers can update their profile' }, { status: 403 })
    }

    const body = await request.json()
    
    // Separate fields that go to sellers table vs users table
    const sellerFields = {}
    const userFields = {}
    
    const allowedSellerFields = [
      'cover_photo', 'business_description', 'instagram', 'facebook', 'x', 'linkedin',
      'primary_mobile', 'business_address', 'city', 'alternate_mobile'
    ]
    
    const allowedUserFields = ['profile_photo']
    
    // Extract seller fields
    allowedSellerFields.forEach(field => {
      if (body[field] !== undefined) {
        sellerFields[field] = body[field]
      }
    })
    
    // Extract user fields
    allowedUserFields.forEach(field => {
      if (body[field] !== undefined) {
        userFields[field] = body[field]
      }
    })
    
    // Update sellers table if there are changes
    if (Object.keys(sellerFields).length > 0) {
      const { error: sellerError } = await supabase
        .from('sellers')
        .update(sellerFields)
        .eq('id', user.id)
      
      if (sellerError) {
        console.error('Error updating seller:', sellerError)
        return NextResponse.json({ error: sellerError.message }, { status: 500 })
      }
    }
    
    // Update users table if there are changes
    if (Object.keys(userFields).length > 0) {
      const { error: userError } = await supabase
        .from('users')
        .update(userFields)
        .eq('id', user.id)
      
      if (userError) {
        console.error('Error updating user:', userError)
        return NextResponse.json({ error: userError.message }, { status: 500 })
      }
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Profile updated successfully'
    })
  } catch (error) {
    console.error('Error updating seller profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
