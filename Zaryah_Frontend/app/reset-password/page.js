'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabaseClient } from '@/lib/supabase-client'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [canReset, setCanReset] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let mounted = true

    const prepareRecoverySession = async () => {
      try {
        // 1) Try existing session first
        let { data } = await supabaseClient.auth.getSession()

        // 2) If no session, try token_hash flow: /reset-password?token_hash=...&type=recovery
        if (!data.session && typeof window !== 'undefined') {
          const url = new URL(window.location.href)
          const tokenHash = url.searchParams.get('token_hash')
          const type = url.searchParams.get('type')

          if (tokenHash && type === 'recovery') {
            const { error } = await supabaseClient.auth.verifyOtp({
              token_hash: tokenHash,
              type: 'recovery',
            })

            if (!error) {
              const refreshed = await supabaseClient.auth.getSession()
              data = refreshed.data
            }
          }
        }

        // 3) If still no session, try hash-token flow: #access_token=...&refresh_token=...&type=recovery
        if (!data.session && typeof window !== 'undefined' && window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')
          const hashType = hashParams.get('type')

          if (accessToken && refreshToken && hashType === 'recovery') {
            const { error } = await supabaseClient.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })

            if (!error) {
              const refreshed = await supabaseClient.auth.getSession()
              data = refreshed.data
            }
          }
        }

        if (!mounted) return

        if (!data.session) {
          setCanReset(false)
          toast.error('Reset link is invalid or expired. Please request a new one.')
        } else {
          setCanReset(true)
        }

        setIsReady(true)
      } catch (error) {
        if (!mounted) return
        console.error('Recovery session error:', error)
        setCanReset(false)
        toast.error('Unable to verify reset link. Please request a new one.')
        setIsReady(true)
      }
    }

    prepareRecoverySession()
    return () => { mounted = false }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!canReset) {
      toast.error('Recovery session missing. Please request a new reset link.')
      return
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await supabaseClient.auth.updateUser({ password })
      if (error) {
        toast.error(error.message || 'Failed to update password')
        return
      }

      setIsDone(true)
      toast.success('Password updated successfully!')

      // Cleanly sign out recovery session and go to login
      await supabaseClient.auth.signOut()
      setTimeout(() => router.push('/login'), 1200)
    } catch (error) {
      console.error('Reset password error:', error)
      toast.error('Failed to update password')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center px-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center">
          <p className="text-gray-700">Preparing reset link...</p>
        </div>
      </div>
    )
  }

  if (isDone) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl text-center"
        >
          <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-green-100 mb-4">
            <CheckCircle className="h-7 w-7 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Password Updated</h1>
          <p className="text-gray-600">Redirecting to login...</p>
        </motion.div>
      </div>
    )
  }

  if (isReady && !canReset) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl text-center"
        >
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid or Expired Link</h1>
          <p className="text-gray-600 mb-6">Please request a new password reset link from the login page.</p>
          <button
            onClick={() => router.push('/login')}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 px-4 rounded-xl font-semibold transition-colors"
          >
            Go to Login
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center px-4">
      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl space-y-5"
      >
        <h1 className="text-2xl font-bold text-gray-900 text-center">Set New Password</h1>
        <p className="text-sm text-gray-600 text-center">Choose a strong password for your account.</p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="block w-full pl-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 px-4 rounded-xl font-semibold transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Updating...' : 'Update Password'}
        </button>
      </motion.form>
    </div>
  )
}
