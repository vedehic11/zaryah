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
    // Add timeout fallback to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      console.warn('Auth loading timeout - resetting to logged out state')
      setIsLoading(false)
      setUser(null)
      setSupabaseUser(null)
    }, 5000) // 5 second timeout

    // Get initial session
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(loadingTimeout)
      if (session) {
        syncUser(session.user)
      } else {
        setUser(null)
        setSupabaseUser(null)
        setIsLoading(false)
      }
    }).catch((error) => {
      clearTimeout(loadingTimeout)
      console.error('Auth session error:', error)
      setIsLoading(false)
      setUser(null)
      setSupabaseUser(null)
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
      clearTimeout(loadingTimeout)
      subscription.unsubscribe()
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
      console.log('Checking sessionStorage for pending data...')
      console.log('pendingBuyerData exists:', !!sessionStorage.getItem('pendingBuyerData'))
      console.log('pendingSellerData exists:', !!sessionStorage.getItem('pendingSellerData'))

      // Get user from our users table by Supabase auth ID or email (single query with OR)
      let userData = null
      let retries = isAfterRegistration ? 5 : 1 // More retries if called after registration
      
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
          console.log(`User not found, retrying in 1000ms... (attempt ${i + 1}/${retries})`)
          await new Promise(resolve => setTimeout(resolve, 1000))
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
          setSupabaseUser(newUserData)
          setUser({
            id: newUserData.id,
            email: newUserData.email,
            name: newUserData.name,
            role: newUserData.user_type.toLowerCase(),
            userType: newUserData.user_type,
            isVerified: newUserData.is_verified,
            isApproved: newUserData.is_approved,
            profilePhoto: newUserData.profile_photo,
            supabaseAuthId: newUserData.supabase_auth_id
          })
          toast.success('Account created successfully!')
        }
        
        setIsLoading(false)
        return
      }

      // User exists, set their data
      setSupabaseUser(userData)
      setUser({
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.user_type.toLowerCase(),
        userType: userData.user_type,
        supabaseAuthId: userData.supabase_auth_id,
        isApproved: userData.is_approved
      })
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
        setSupabaseUser(authUser)
        setUser({
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.user_type.toLowerCase(),
          userType: result.user.user_type,
          isVerified: result.user.is_verified,
          isApproved: result.user.is_approved,
          supabaseAuthId: authUser.id,
          created_at: result.user.created_at
        })
        
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
