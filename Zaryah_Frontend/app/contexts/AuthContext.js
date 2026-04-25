'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { supabaseClient } from '@/lib/supabase-client'

const AuthContext = createContext(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [supabaseUser, setSupabaseUser] = useState(null)
  const [pendingVerification, setPendingVerification] = useState(null)
  const router = useRouter()

  const isResetPasswordRoute = () => {
    if (typeof window === 'undefined') return false
    return window.location.pathname === '/reset-password'
  }

  const isInvalidRefreshTokenError = (error) => {
    const message = String(error?.message || error || '').toLowerCase()
    return message.includes('invalid refresh token') || message.includes('refresh token not found')
  }

  const clearLocalAuthState = () => {
    setUser(null)
    setSupabaseUser(null)
    setIsLoading(false)
    sessionStorage.removeItem('zaryah_user_cache')

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('zaryah-auth-token')
    }
  }

  // Sync Supabase Auth user with our users table
  useEffect(() => {
    let isMounted = true
    let loadingTimeout = null

    // Don't restore from cache - it causes API auth issues
    // The session needs to be validated first before user is set
    // Cache is only used for faster subsequent syncs, not for initial load

    // Add timeout fallback to prevent infinite loading
    loadingTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn('Auth loading timeout - resetting to logged out state')
        setIsLoading(false)
        setUser(null)
        setSupabaseUser(null)
        sessionStorage.removeItem('zaryah_user_cache')
      }
    }, 10000) // 10 second timeout

    // Get initial session
    ;(async () => {
      try {
        const { data: { session }, error } = await supabaseClient.auth.getSession()

        if (!isMounted) return
        if (loadingTimeout) clearTimeout(loadingTimeout)

        if (error) {
          throw error
        }

        if (session) {
          if (isResetPasswordRoute()) {
            setSupabaseUser(session.user)
            setUser(null)
            setIsLoading(false)
            return
          }
          syncUser(session.user)
        } else {
          clearLocalAuthState()
        }
      } catch (error) {
        if (!isMounted) return
        if (loadingTimeout) clearTimeout(loadingTimeout)

        if (isInvalidRefreshTokenError(error)) {
          clearLocalAuthState()
          return
        }

        console.error('Auth session error:', error)
        clearLocalAuthState()
      }
    })()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return
      
      console.log('Auth state changed:', event)
      
      // Only sync on specific events to avoid redundant calls
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          if (isResetPasswordRoute()) {
            setSupabaseUser(session.user)
            setUser(null)
            setIsLoading(false)
            return
          }
          await syncUser(session.user)
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setSupabaseUser(null)
        setIsLoading(false)
        sessionStorage.removeItem('zaryah_user_cache')
      }
    })

    // Handle page visibility changes (tab switching)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && !isLoading) {
        // Tab became visible - verify session is still valid
        try {
          const { data: { session }, error } = await supabaseClient.auth.getSession()

          if (error) {
            throw error
          }

          if (!session && user) {
            // Session expired while tab was hidden
            clearLocalAuthState()
            toast.error('Your session has expired. Please log in again.')
          }
        } catch (error) {
          if (isInvalidRefreshTokenError(error)) {
            clearLocalAuthState()
            return
          }

          console.error('Error checking session on visibility change:', error)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isMounted = false
      if (loadingTimeout) clearTimeout(loadingTimeout)
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const syncUser = async (authUser, isAfterRegistration = false) => {
    // Skip sync if we're in the middle of registration
    // This prevents race condition where onAuthStateChange fires before API creates DB records
    if (sessionStorage.getItem('registering')) {
      console.log('Registration in progress, skipping sync...')
      return
    }

    try {
      setIsLoading(true)
      
      console.log('syncUser called for:', authUser.email, 'isAfterRegistration:', isAfterRegistration)
      
      // Try to use cached user data if available and auth IDs match
      const cachedUser = sessionStorage.getItem('zaryah_user_cache')
      if (cachedUser && !isAfterRegistration) {
        try {
          const parsedCache = JSON.parse(cachedUser)
          if (parsedCache.supabaseAuthId === authUser.id) {
            console.log('Using cached user data for:', parsedCache.email)
            setSupabaseUser(authUser)
            setUser(parsedCache)
            setIsLoading(false)
            return
          }
        } catch (e) {
          console.error('Failed to parse cached user', e)
          sessionStorage.removeItem('zaryah_user_cache')
        }
      }
      
      console.log('Checking sessionStorage for pending data...')
      console.log('pendingBuyerData exists:', !!sessionStorage.getItem('pendingBuyerData'))
      console.log('pendingSellerData exists:', !!sessionStorage.getItem('pendingSellerData'))

      // Get user from our users table by Supabase auth ID or email (single query with OR)
      let userData = null
      let retries = isAfterRegistration ? 3 : 1 // Reduced retries to prevent long waits
      
      for (let i = 0; i < retries; i++) {
        const { data, error } = await supabaseClient
          .from('users')
          .select('*')
          .or(`supabase_auth_id.eq.${authUser.id},email.eq.${authUser.email}`)
          .maybeSingle()

        if (data) {
          userData = data
          console.log('User found:', userData.email)
          break
        }
        
        if (i < retries - 1) {
          console.log(`User not found, retrying in 500ms... (attempt ${i + 1}/${retries})`)
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      // If found by email but not linked, update the supabase_auth_id
      if (userData && !userData.supabase_auth_id) {
        await supabaseClient
          .from('users')
          .update({ supabase_auth_id: authUser.id })
          .eq('id', userData.id)
        userData.supabase_auth_id = authUser.id // Update local copy
      }

      // If user still doesn't exist after registration, just set loading to false
      // The user state was already set from the API response
      if (!userData && isAfterRegistration) {
        console.log('User not found in query after registration (already set from API response)')
        setIsLoading(false)
        return
      }

      // If user doesn't exist in our users table, create it from pending data or auth metadata
      if (!userData) {
        console.log('User not found in database, checking for pending registration data...')
        
        // Check for pending registration data in sessionStorage
        const pendingBuyerData = sessionStorage.getItem('pendingBuyerData')
        const pendingSellerData = sessionStorage.getItem('pendingSellerData')
        
        let newUserData = null
        
        if (pendingBuyerData) {
          const buyerData = JSON.parse(pendingBuyerData)
          console.log('Creating buyer from pending data:', buyerData.email)
          console.log('Buyer data to insert:', {
            email: buyerData.email,
            name: buyerData.name,
            city: buyerData.city,
            mobile: buyerData.mobile,
            address: buyerData.address
          })
          
          // Try to get existing user first
          const { data: existingUser } = await supabaseClient
            .from('users')
            .select('*')
            .eq('email', buyerData.email)
            .maybeSingle()
          
          let createdUser = existingUser
          
          if (!existingUser) {
            // Create buyer user
            const { data: newUser, error: createError } = await supabaseClient
              .from('users')
              .insert({
                email: buyerData.email,
                name: buyerData.name,
                user_type: 'Buyer',
                supabase_auth_id: authUser.id,
                is_verified: true,
                is_approved: true
              })
              .select()
              .single()
            
            if (createError) {
              console.error('Error creating buyer user:', createError)
              throw new Error('Failed to create user account')
            }
            
            createdUser = newUser
            console.log('User created successfully, now creating buyer record...')
          } else {
            console.log('User already exists, updating auth ID and creating buyer record...')
            // Update supabase_auth_id if not set
            if (!existingUser.supabase_auth_id) {
              await supabaseClient
                .from('users')
                .update({ supabase_auth_id: authUser.id })
                .eq('id', existingUser.id)
            }
          }
          
          // Create buyer record
          if (createdUser) {
            // Check if buyer record already exists
            const { data: existingBuyer } = await supabaseClient
              .from('buyers')
              .select('id')
              .eq('id', createdUser.id)
              .maybeSingle()
            
            if (existingBuyer) {
              console.log('Buyer record already exists, skipping creation')
              newUserData = createdUser
            } else {
              const buyerRecord = {
                id: createdUser.id,
                full_name: buyerData.name,
                city: buyerData.city || 'Mumbai',
                primary_mobile: buyerData.mobile || buyerData.address?.phone
              }
              
              console.log('Inserting buyer record:', buyerRecord)
              
              const { error: buyerError } = await supabaseClient
                .from('buyers')
                .insert(buyerRecord)
              
              if (buyerError) {
                console.error('Error creating buyer record:', buyerError)
                console.error('Full error details:', JSON.stringify(buyerError, null, 2))
                toast.error('Failed to complete buyer registration. Please contact support.')
              } else {
                console.log('Buyer record created successfully')
              }
              
              newUserData = createdUser
            }
          }
          
          sessionStorage.removeItem('pendingBuyerData')
          
        } else if (pendingSellerData) {
          const sellerData = JSON.parse(pendingSellerData)
          console.log('Creating seller from pending data:', sellerData.email)
          
          // Create seller user
          const { data: createdUser, error: createError } = await supabaseClient
            .from('users')
            .insert({
              email: sellerData.email,
              name: sellerData.name,
              user_type: 'Seller',
              supabase_auth_id: authUser.id,
              is_verified: true,
              is_approved: false // Sellers need admin approval
            })
            .select()
            .single()
          
          if (createError) {
            console.error('Error creating seller user:', createError)
            throw new Error('Failed to create user account')
          }
          
          // Create seller record
          if (createdUser) {
            await supabaseClient
              .from('sellers')
              .insert({
                id: createdUser.id,
                full_name: sellerData.name,
                business_name: sellerData.businessName,
                business_description: sellerData.description,
                city: sellerData.city || 'Mumbai',
                primary_mobile: sellerData.mobile,
                business_address: sellerData.verificationData?.businessAddress,
                account_holder_name: sellerData.verificationData?.accountHolderName,
                account_number: sellerData.verificationData?.accountNumber,
                ifsc_code: sellerData.verificationData?.ifscCode,
                id_document: sellerData.verificationData?.idDocument,
                business_document: sellerData.verificationData?.businessDocument,
                cover_photo: sellerData.verificationData?.coverPhoto,
                instagram: sellerData.verificationData?.instagram,
                facebook: sellerData.verificationData?.facebook,
                x: sellerData.verificationData?.x,
                linkedin: sellerData.verificationData?.linkedin
              })
            
            newUserData = createdUser
          }
          
          sessionStorage.removeItem('pendingSellerData')
        } else {
          // No pending data and no user in database
          console.error('No pending registration data found for:', authUser.email)
          await supabaseClient.auth.signOut()
          toast.error('Account not found. Please register first.')
          setUser(null)
          setIsLoading(false)
          return
        }
        
        if (newUserData) {
          // Use the newly created user data
          const newUserObj = {
            id: newUserData.id,
            email: newUserData.email,
            name: newUserData.name,
            role: newUserData.user_type.toLowerCase(),
            userType: newUserData.user_type,
            isVerified: newUserData.is_verified,
            isApproved: newUserData.is_approved,
            profilePhoto: newUserData.profile_photo,
            supabaseAuthId: newUserData.supabase_auth_id
          }
          
          setSupabaseUser(newUserData)
          setUser(newUserObj)
          
          // Cache user data
          sessionStorage.setItem('zaryah_user_cache', JSON.stringify(newUserObj))
          
          toast.success('Account created successfully!')
        }
        
        setIsLoading(false)
        return
      }

      // User exists, set their data
      const userDataToSet = {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.user_type.toLowerCase(),
        userType: userData.user_type,
        supabaseAuthId: userData.supabase_auth_id,
        isApproved: userData.is_approved
      }
      
      setSupabaseUser(userData)
      setUser(userDataToSet)
      
      // Cache user data for instant restore on page reload
      sessionStorage.setItem('zaryah_user_cache', JSON.stringify(userDataToSet))
      
      setIsLoading(false)
    } catch (error) {
      console.error('Error syncing user:', error)
      setUser(null)
      setIsLoading(false)
    }
  }


  // Login function - uses Supabase Auth
  const login = async (email, password, userType = 'Buyer') => {
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        toast.error(error.message || 'Login failed')
        return false
      }

      // User will be synced via onAuthStateChange
      toast.success('Logged in successfully!')
      return true
    } catch (error) {
      console.error('Login error:', error)
      toast.error('Login failed')
      return false
    }
  }

  // Register function - uses Supabase Auth
  const register = async (
    email,
    password,
    name,
    role = 'buyer',
    city = 'Mumbai',
    address = null,
    businessName,
    description,
    mobile,
    verificationDoc,
    verificationData = null
  ) => {
    try {
      // Set flag BEFORE signup to block onAuthStateChange from calling syncUser
      sessionStorage.setItem('registering', 'true')
      
      // Sign up with Supabase Auth
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
            role: role
          }
        }
      })

      if (error) {
        console.error('Supabase signup error:', error)
        
        // Clear the registering flag on error
        sessionStorage.removeItem('registering')
        
        if (error.message.includes('already registered') || error.message.includes('already exists') || error.message.includes('User already registered')) {
          toast.error('This email is already registered. Please login instead.')
        } else {
          toast.error(error.message || 'Registration failed')
        }
        return { success: false, requiresOtp: false }
      }

      // If email confirmation is required
      if (data.user && !data.session) {
        // Store registration data temporarily for after email verification
        const registrationData = {
          email,
          name,
          city,
          businessName,
          description,
          mobile,
          address,
          verificationData
        }
        
        if (role === 'seller') {
          sessionStorage.setItem('pendingSellerData', JSON.stringify(registrationData))
        } else {
          sessionStorage.setItem('pendingBuyerData', JSON.stringify(registrationData))
        }
        
        toast.success('Please check your email to confirm your account')
        setPendingVerification({ email, userType: role })
        return { success: true, requiresOtp: true }
      }

      // If immediate login (no email confirmation required)
      // Create user and buyer/seller records via API
      console.log('Creating user records via API...')
      
      const authUser = data.user
      
      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: authUser.id,
            email,
            name,
            mobile: mobile || address?.phone,
            userType: role,
            address,
            businessInfo: role === 'seller' ? {
              businessName: businessName || name,
              description: description || 'Handcrafted products',
              username: verificationData?.username || email.split('@')[0],
              accountHolderName: verificationData?.accountHolderName || name,
              accountNumber: verificationData?.accountNumber || 'pending',
              ifscCode: verificationData?.ifscCode || 'pending',
              idType: verificationData?.idType || 'Aadhar Card',
              idNumber: verificationData?.idNumber || 'pending',
              idDocument: verificationDoc || 'pending',
              gstNumber: verificationData?.gstNumber || null,
              // Social media fields - at least one required
              instagram: verificationData?.instagram || null,
              facebook: verificationData?.facebook || null,
              x: verificationData?.x || verificationData?.twitter || null,
              linkedin: verificationData?.linkedin || null
            } : null
          }),
        })

        const result = await response.json()
        
        if (!result.success) {
          console.error('API error creating records:', result.error)
          console.error('Full API response:', result)
          
          // Log detailed error information
          if (result.details) {
            console.error('Database error details:', result.details)
          }
          if (result.message) {
            console.error('Error message:', result.message)
          }
          if (result.code) {
            console.error('Error code:', result.code)
          }
          
          // If already exists, sign out and show error
          if (result.alreadyExists) {
            await supabaseClient.auth.signOut()
            sessionStorage.removeItem('registering')
            toast.error('Email already registered. Please login instead.')
            return { success: false, requiresOtp: false }
          }
          
          await supabaseClient.auth.signOut()
          sessionStorage.removeItem('registering')
          
          // Show more specific error message if available
          const errorMsg = result.message || result.error || 'Failed to create user account'
          toast.error(errorMsg)
          return { success: false, requiresOtp: false }
        }

        console.log('User records created successfully')
        
        // Clear the registering flag
        sessionStorage.removeItem('registering')
        
        // Set user state manually to log them in immediately
        const newUserData = {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.user_type.toLowerCase(),
          userType: result.user.user_type,
          isVerified: result.user.is_verified,
          isApproved: result.user.is_approved,
          supabaseAuthId: authUser.id,
          created_at: result.user.created_at
        }
        
        setSupabaseUser(authUser)
        setUser(newUserData)
        
        // Cache user data
        sessionStorage.setItem('zaryah_user_cache', JSON.stringify(newUserData))
        
        toast.success('Registration successful!')
        return { success: true, requiresOtp: false }
      } catch (apiError) {
        // Clear the registering flag on error
        sessionStorage.removeItem('registering')
        console.error('Error calling register API:', apiError)
        await supabaseClient.auth.signOut()
        toast.error('Failed to create user account')
        return { success: false, requiresOtp: false }
      }
    } catch (error) {
      console.error('Registration error:', error)
      toast.error('Registration failed')
      return { success: false, requiresOtp: false }
    }
  }

  // Logout function
  const logout = async () => {
    let signOutError = null

    try {
      const { error } = await supabaseClient.auth.signOut()
      signOutError = error || null
    } catch (error) {
      signOutError = error
    } finally {
      setUser(null)
      setSupabaseUser(null)
      setIsLoading(false)
      sessionStorage.removeItem('zaryah_user_cache')

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('zaryah-auth-token')
      }
    }

    if (signOutError) {
      console.error('Logout error:', signOutError)

      const errorMessage = String(signOutError.message || signOutError)
      const isSafeToIgnore = errorMessage.toLowerCase().includes('session') || errorMessage.toLowerCase().includes('jwt')

      if (!isSafeToIgnore) {
        toast.error('Logout failed on server, but you have been signed out on this device')
        return false
      }
    }

    toast.success('Logged out successfully')
    return true
  }

  // Verify OTP - for email confirmation
  const verifyOtp = async (email, otp, userType) => {
    try {
      const { data, error } = await supabaseClient.auth.verifyOtp({
        email,
        token: otp,
        type: 'email'
      })

      if (error) {
        toast.error(error.message || 'Verification failed')
        return false
      }
      
      // Clear pending verification state
      setPendingVerification(null)
      
      toast.success('Email verified successfully!')
      return true
    } catch (error) {
      console.error('OTP verification error:', error)
      toast.error('Verification failed')
      return false
    }
  }

  // Update user type (for admin to change user roles)
  const updateUserType = async (userId, newUserType) => {
    try {
      const { error } = await supabaseClient
        .from('users')
        .update({ user_type: newUserType })
        .eq('id', userId)

      if (error) throw error

      // Refresh user data
      if (user?.id === userId) {
        setUser(prev => ({ ...prev, role: newUserType.toLowerCase(), userType: newUserType }))
      }

      toast.success('User type updated successfully')
      return true
    } catch (error) {
      console.error('Error updating user type:', error)
      toast.error('Failed to update user type')
      return false
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        verifyOtp,
        updateUserType,
        pendingVerification,
        setPendingVerification,
        supabaseUser // Expose Supabase user data
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
