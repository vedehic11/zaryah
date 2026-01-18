'use client'

import { useAuth } from '../contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    } else if (!isLoading && user && requiredRole) {
      // Check both role and userType for compatibility
      const userRole = user.role || user.userType?.toLowerCase() || user.user_type?.toLowerCase()
      const requiredRoleLower = requiredRole?.toLowerCase()
      if (userRole !== requiredRoleLower) {
        router.push('/')
      }
    }
  }, [user, isLoading, requiredRole, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  // Check both role and userType for compatibility
  const userRole = user.role || user.userType?.toLowerCase() || user.user_type?.toLowerCase()
  const requiredRoleLower = requiredRole?.toLowerCase()
  if (requiredRole && userRole !== requiredRoleLower) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    )
  }

  return children
}