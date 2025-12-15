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

  // Sync Supabase Auth user with our users table
  useEffect(() => {
    // Get initial session
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        syncUser(session.user)
      } else {
        setUser(null)
        setSupabaseUser(null)
        setIsLoading(false)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await syncUser(session.user)
        } else {
        setUser(null)
        setSupabaseUser(null)
        setIsLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const syncUser = async (authUser) => {
    try {
      setIsLoading(true)

      // Get user from our users table by Supabase auth ID
      // Note: We query role-specific data separately to avoid relationship ambiguity
      const { data: supabaseUserData, error } = await supabaseClient
        .from('users')
        .select('*')
        .eq('supabase_auth_id', authUser.id)
        .single()

      // If user not found by supabase_auth_id, try by email (for migration cases)
      let userData = supabaseUserData
      if (error && error.code === 'PGRST116') { // PGRST116 = not found
        // Try to find by email
        const { data: emailUserData, error: emailError } = await supabaseClient
          .from('users')
          .select('*')
          .eq('email', authUser.email)
          .single()
        
        if (emailUserData && !emailError) {
          // User exists but not linked - update the supabase_auth_id
          const { data: updatedUser } = await supabaseClient
            .from('users')
            .update({ supabase_auth_id: authUser.id })
            .eq('id', emailUserData.id)
            .select('*')
            .single()
          
          userData = updatedUser || emailUserData
        }
      } else if (error && error.code !== 'PGRST116') {
        // Other error (not "not found") - only log if it's a real error
        // PGRST116 is expected when user doesn't exist, so we don't log it
        // Extract meaningful error information
        const errorMessage = error.message || error.details || error.hint || error.code
        // Only log if there's meaningful error information and it's not a "not found" type error
        if (errorMessage && 
            typeof errorMessage === 'string' && 
            !errorMessage.includes('No rows') && 
            !errorMessage.includes('not found') &&
            errorMessage !== 'PGRST116') {
          console.error('Error fetching user from Supabase:', errorMessage)
        }
        // If error object is empty or has no meaningful info, silently continue
      }

      // If user doesn't exist in our users table, create them
      if (!userData) {
        // Check if this is a pending seller registration
        let pendingSellerData = null
        try {
          const storedData = sessionStorage.getItem('pendingSellerData')
          if (storedData) {
            pendingSellerData = JSON.parse(storedData)
            sessionStorage.removeItem('pendingSellerData')
          }
        } catch (e) {
          // Ignore sessionStorage errors
        }

        const isSeller = pendingSellerData || authUser.user_metadata?.role === 'seller'
        const userType = isSeller ? 'Seller' : 'Buyer'

        // Create user in our users table
        // NOTE: Admin users can ONLY be created via SQL script
        const { data: newUser, error: createError } = await supabaseClient
          .from('users')
          .insert({
            email: authUser.email,
            name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
            user_type: userType,
            supabase_auth_id: authUser.id,
            is_verified: authUser.email_confirmed_at !== null,
            is_approved: isSeller ? false : true // Sellers need admin approval
          })
          .select()
          .single()

        if (createError) {
          // Check if this is a conflict error (user already exists)
          const isConflictError = createError.code === '23505' || 
                                  createError.message?.includes('duplicate') || 
                                  createError.message?.includes('unique') ||
                                  createError.message?.includes('already exists') ||
                                  createError.code === '23503' // Foreign key violation
          
          if (isConflictError) {
            // User might already exist - try to fetch by email
            const { data: existingUser, error: fetchError } = await supabaseClient
              .from('users')
              .select('*')
              .eq('email', authUser.email)
              .single()
            
            if (existingUser && !fetchError) {
              // Update the supabase_auth_id if it's null
              if (!existingUser.supabase_auth_id) {
                await supabaseClient
                  .from('users')
                  .update({ supabase_auth_id: authUser.id })
                  .eq('id', existingUser.id)
              }
              userData = existingUser
            }
            // If couldn't find existing user, silently continue - user might be created elsewhere
          } else {
            // Real error (not a conflict) - only log if there's meaningful error information
            const errorMessage = createError.message || createError.details || createError.hint || createError.code
            if (errorMessage && 
                typeof errorMessage === 'string' && 
                errorMessage.length > 0) {
              console.error('Error creating user in Supabase:', errorMessage)
            }
            setUser(null)
            setIsLoading(false)
            return
          }
        } else {
          // User created successfully
          if (isSeller && pendingSellerData) {
            // Create seller record with all business details
            const sellerRecord = {
              id: newUser.id,
              full_name: pendingSellerData.name,
              business_name: pendingSellerData.businessName,
              username: pendingSellerData.verificationData?.username || null,
              cover_photo: pendingSellerData.verificationData?.coverPhoto || null,
              primary_mobile: pendingSellerData.mobile,
              business_address: pendingSellerData.verificationData?.businessAddress || '',
              business_description: pendingSellerData.description,
              city: pendingSellerData.city,
              id_type: pendingSellerData.verificationData?.idType || 'Aadhar Card',
              id_number: pendingSellerData.verificationData?.idNumber || '',
              id_document: pendingSellerData.verificationData?.idDocument || 'pending',
              business_document: pendingSellerData.verificationData?.businessDocument || null,
              account_holder_name: pendingSellerData.verificationData?.accountHolderName || pendingSellerData.name,
              account_number: pendingSellerData.verificationData?.accountNumber || '',
              ifsc_code: pendingSellerData.verificationData?.ifscCode || '',
              instagram: pendingSellerData.verificationData?.instagram,
              facebook: pendingSellerData.verificationData?.facebook,
              x: pendingSellerData.verificationData?.twitter,
              linkedin: pendingSellerData.verificationData?.linkedin,
              alternate_mobile: pendingSellerData.verificationData?.alternateMobile,
              gst_number: pendingSellerData.verificationData?.gstNumber,
              pan_number: pendingSellerData.verificationData?.panNumber
            }

            await supabaseClient
              .from('sellers')
              .insert(sellerRecord)

            toast.success('Seller registration submitted! Waiting for admin approval.')
          } else {
            // Create buyer record
            const buyerRecord = {
              id: newUser.id,
              city: pendingSellerData?.city || 'Mumbai'
            }

            if (pendingSellerData?.address) {
              buyerRecord.address = pendingSellerData.address.address || ''
              buyerRecord.state = pendingSellerData.address.state || ''
              buyerRecord.pincode = pendingSellerData.address.pincode || ''
              buyerRecord.phone = pendingSellerData.address.phone || ''
            }

            await supabaseClient
              .from('buyers')
              .insert(buyerRecord)
          }

          // Set the newly created user
          setSupabaseUser(newUser)
          setUser({
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            role: newUser.user_type.toLowerCase(),
            userType: newUser.user_type,
            supabaseAuthId: newUser.supabase_auth_id,
            isApproved: newUser.is_approved
          })
          setIsLoading(false)
          return
        }
      }

      // User exists, set their data
      if (userData) {
        // Fetch role-specific data separately to avoid relationship ambiguity
        let roleData = {}
        if (userData.user_type === 'Buyer') {
          const { data: buyerData } = await supabaseClient
            .from('buyers')
            .select('*')
            .eq('id', userData.id)
            .single()
          roleData = buyerData || {}
        } else if (userData.user_type === 'Seller') {
          const { data: sellerData } = await supabaseClient
            .from('sellers')
            .select('*')
            .eq('id', userData.id)
            .single()
          roleData = sellerData || {}
        } else if (userData.user_type === 'Admin') {
          const { data: adminData } = await supabaseClient
            .from('admins')
            .select('*')
            .eq('id', userData.id)
            .single()
          roleData = adminData || {}
        }
        
        setSupabaseUser(userData)

        setUser({
          id: userData.id,
          email: userData.email,
          name: userData.name,
          role: userData.user_type.toLowerCase(),
          userType: userData.user_type,
          supabaseAuthId: userData.supabase_auth_id,
          isVerified: userData.is_verified,
          isApproved: userData.is_approved,
          ...roleData
        })
      }
    } catch (error) {
      console.error('Error syncing user:', error)
      setUser(null)
    } finally {
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
        toast.error(error.message || 'Registration failed')
        return { success: false, requiresOtp: false }
      }

      // If email confirmation is required
      if (data.user && !data.session) {
        // Store registration data temporarily for after email verification
        if (role === 'seller') {
          sessionStorage.setItem('pendingSellerData', JSON.stringify({
            email,
            name,
            city,
            businessName,
            description,
            mobile,
            address,
            verificationData
          }))
        }
        
        toast.success('Please check your email to confirm your account')
        setPendingVerification({ email, userType: role })
        return { success: true, requiresOtp: true }
      }

      // User will be synced via onAuthStateChange
      toast.success('Registration successful!')
      return { success: true, requiresOtp: false }
    } catch (error) {
      console.error('Registration error:', error)
      toast.error('Registration failed')
      return { success: false, requiresOtp: false }
    }
  }

  // Logout function
  const logout = async () => {
    try {
      const { error } = await supabaseClient.auth.signOut()
      
      if (error) {
        toast.error('Logout failed')
        return
      }

      // Clear local state
      setUser(null)
      setSupabaseUser(null)
      
      toast.success('Logged out successfully')
        } catch (error) {
      console.error('Logout error:', error)
      toast.error('Logout failed')
    }
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
