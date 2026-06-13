'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, User, KeyRound, ArrowLeft, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { OtpVerification } from './OtpVerification'
import Link from 'next/link'
import Image from 'next/image'
const LOGO_SRC = '/assets/image.png?v=20260501'
import toast from 'react-hot-toast'

// ─── Forgot Password Sub-Component ─────────────────────────────────────────
const ForgotPassword = ({ onBack }) => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const sendEmailResetLink = async () => {
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !/\S+@\S+\.\S+/.test(trimmedEmail)) {
      toast.error('Enter a valid email address')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/send-reset-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail })
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error || 'Failed to send reset link')
        return
      }

      toast.success('Password reset link sent to your email')
    } catch (error) {
      console.error('sendEmailResetLink error:', error)
      toast.error('Failed to send reset link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Reset via Email Link</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Mail className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Enter your account email"
            className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <button
          type="button"
          onClick={sendEmailResetLink}
          disabled={loading}
          className="w-full border border-primary-300 text-primary-700 hover:bg-primary-50 py-3 px-4 rounded-xl font-semibold transition-colors disabled:opacity-50"
        >
          {loading ? 'Sending link...' : 'Send Reset Link'}
        </button>
      </div>

      <button type="button" onClick={onBack} className="w-full text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Back to Sign In
      </button>
    </div>
  )
}

// ─── LoginPage ───────────────────────────────────────────────────────────────
export const LoginPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    userType: 'Buyer'
  })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { login, isLoading, pendingVerification, setPendingVerification } = useAuth()
  const [showUnverifiedWarning, setShowUnverifiedWarning] = useState(false)
  const [unverifiedEmail, setUnverifiedEmail] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTarget = String(searchParams.get('redirect') || '').trim()
  const safeRedirectTarget = redirectTarget.startsWith('/') || redirectTarget.startsWith('http')
    ? redirectTarget
    : ''
  const backToSellerUrl = safeRedirectTarget.startsWith('http') ? safeRedirectTarget : ''

  // Handle email verification message/error query parameters
  useEffect(() => {
    // Clear stale registration flags on login page mount
    sessionStorage.removeItem('registering')
    sessionStorage.removeItem('pendingBuyerData')
    sessionStorage.removeItem('pendingSellerData')

    const message = searchParams.get('message')
    const error = searchParams.get('error')
    const emailParam = searchParams.get('email')

    if (emailParam) {
      setUnverifiedEmail(emailParam)
    }

    if (message) {
      if (message === 'email_verified') {
        toast.success('Your email has been verified successfully! Please sign in.')
      } else if (message === 'already_verified') {
        toast.success('Your email is already verified. Please sign in.')
      } else if (message === 'check_email') {
        toast.success('Registration successful! Please check your email for a verification link.')
      }
      
      // Clean up search params to avoid toast repeating on page reload
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        params.delete('message')
        const newPath = window.location.pathname + (params.toString() ? `?${params.toString()}` : '')
        window.history.replaceState({}, '', newPath)
      }
    }

    if (error) {
      if (error === 'invalid_token') {
        toast.error('The verification link is invalid. Please request a new one.')
      } else if (error === 'token_expired') {
        toast.error('The verification link has expired. Please register again.')
      } else if (error === 'verification_failed') {
        toast.error('Verification failed. Please contact support.')
      } else if (error === 'unverified') {
        toast.error('Please verify your email address before logging in.')
        setShowUnverifiedWarning(true)
        if (emailParam) {
          setFormData(prev => ({ ...prev, email: emailParam }))
        }
      }
      
      // Clean up search params to avoid toast repeating on page reload
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        params.delete('error')
        params.delete('email')
        const newPath = window.location.pathname + (params.toString() ? `?${params.toString()}` : '')
        window.history.replaceState({}, '', newPath)
      }
    }
  }, [searchParams])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.email) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email'
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleResendAndVerify = async () => {
    const email = formData.email || unverifiedEmail
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      toast.error('Please enter a valid email address')
      return
    }

    try {
      toast.loading('Sending verification code...', { id: 'resend-otp' })
      const response = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error || 'Failed to send verification code', { id: 'resend-otp' })
        return
      }

      toast.success('Verification code sent to your email!', { id: 'resend-otp' })
      
      // Save credentials for auto-login after OTP verification (survives hard refresh)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('pendingCredentials', JSON.stringify({
          email: email,
          password: formData.password
        }))
      }

      setPendingVerification({ email, userType: formData.userType.toLowerCase() })
      setShowUnverifiedWarning(false)
    } catch (err) {
      console.error(err)
      toast.error('Failed to send verification code', { id: 'resend-otp' })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setIsSubmitting(true)
    try {
      // Login with Supabase Auth
      const result = await login(formData.email, formData.password, formData.userType)

      const success = Boolean(result)
      
      if (success) {
        if (safeRedirectTarget) {
          if (safeRedirectTarget.startsWith('http') && typeof window !== 'undefined') {
            window.location.href = safeRedirectTarget
            return
          }
          router.push(safeRedirectTarget)
          return
        }

        // Redirect based on user type
        if (formData.userType === 'Admin') {
          router.push('/admin')
        } else if (formData.userType === 'Seller') {
          router.push('/seller/dashboard')
        } else {
          router.push('/')
        }
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (pendingVerification) {
    return (
      <OtpVerification
        email={pendingVerification.email}
        userType={pendingVerification.userType}
        onVerificationSuccess={() => {
          const defaultTarget = formData.userType === 'Seller' ? '/seller/dashboard' : '/'
          const safeRedirectTarget = redirectTarget.startsWith('/') || redirectTarget.startsWith('http')
            ? redirectTarget
            : defaultTarget
          if (safeRedirectTarget.startsWith('http') && typeof window !== 'undefined') {
            window.location.href = safeRedirectTarget
          } else {
            router.push(safeRedirectTarget)
          }
        }}
        onBack={() => setPendingVerification(null)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8"
      >
        {/* Header */}
        <div className="text-center">
          {backToSellerUrl && (
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.href = backToSellerUrl
                }
              }}
              className="mb-3 inline-flex items-center gap-2 rounded-xl border border-primary-200 bg-white px-3 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Seller
            </button>
          )}
          <div className="flex items-center justify-center mb-4">
            <Image
              src={LOGO_SRC}
              alt="Zaryah"
              width={280}
              height={84}
              className="h-16 w-auto"
              priority
            />
          </div>
          {showForgotPassword ? (
            <>
              <h2 className="text-3xl font-bold text-gray-900">Reset Password</h2>
              <p className="mt-2 text-gray-600">Get a secure email link to reset your password</p>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-bold text-gray-900">Welcome back</h2>
              <p className="mt-2 text-gray-600">Sign in to your account to continue your journey</p>
            </>
          )}
        </div>

        {/* Forgot Password panel */}
        <AnimatePresence mode="wait">
          {showForgotPassword && (
            <motion.div
              key="forgot"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="bg-white p-8 rounded-2xl shadow-xl"
            >
              <ForgotPassword onBack={() => setShowForgotPassword(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Login Form */}
        <AnimatePresence mode="wait">
        {!showForgotPassword && (
          <>
            {showUnverifiedWarning && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 space-y-3 mt-4"
              >
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 mr-2 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm">Email Verification Pending</h4>
                    <p className="text-xs text-amber-600 mt-1 leading-relaxed">
                      Your email address <strong>{formData.email || unverifiedEmail}</strong> is registered but not verified yet.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResendAndVerify}
                  className="w-full text-center bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold py-2.5 px-4 rounded-xl transition-colors"
                >
                  Verify Email Now
                </button>
              </motion.div>
            )}
            <motion.form
              key="login"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-8 space-y-6 bg-white p-8 rounded-2xl shadow-xl"
              onSubmit={handleSubmit}
            >
          <div className="space-y-4">
            {/* User Type Selection */}
            <div>
              <label htmlFor="userType" className="block text-sm font-medium text-gray-700 mb-2">
                I am a
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'Buyer', label: 'Buyer', icon: User },
                  { value: 'Seller', label: 'Seller', icon: User }
                ].map((type) => {
                  const Icon = type.icon
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, userType: type.value }))}
                      className={`flex items-center justify-center space-x-2 p-3 rounded-xl border-2 transition-all ${
                        formData.userType === type.value
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{type.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`block w-full pl-10 pr-3 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
                    errors.email ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter your email"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`block w-full pl-10 pr-10 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
                    errors.password ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 px-4 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </motion.button>

          {/* Links */}
          <div className="text-center space-y-2 mt-6">
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1 mx-auto"
            >
              <KeyRound className="w-3.5 h-3.5" /> Forgot Password?
            </button>
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link 
                href={`/register${redirectTarget ? `?redirect=${encodeURIComponent(redirectTarget)}` : ''}`} 
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                Sign up here
              </Link>
            </p>
          </div>
        </motion.form>
          </>
        )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
