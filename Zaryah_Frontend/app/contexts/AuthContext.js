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

  const syncUser = async (authUser) => {
    try {
      setIsLoading(true)

      // Get user from our users table by Supabase auth ID or email (single query with OR)
      const { data: userData, error } = await supabaseClient
        .from('users')
        .select('*')
        .or(`supabase_auth_id.eq.${authUser.id},email.eq.${authUser.email}`)
        .maybeSingle()

      // If found by email but not linked, update the supabase_auth_id
      if (userData && !userData.supabase_auth_id) {
        await supabaseClient
          .from('users')
          .update({ supabase_auth_id: authUser.id })
          .eq('id', userData.id)
        userData.supabase_auth_id = authUser.id // Update local copy
      }

      // If user doesn't exist in our users table, they shouldn't be logging in
      // (user creation happens during registration, not login)
      if (!userData) {
      // If user doesn't exist in our users table, they shouldn't be logging in
      // (user creation happens during registration, not login)
      if (!userData) {
        console.error('User not found in database for auth user:', authUser.email)
        await supabaseClient.auth.signOut()
        toast.error('Account not found. Please register first.')
        setUser(null)
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
      // Store data temporarily for syncUser to use
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
