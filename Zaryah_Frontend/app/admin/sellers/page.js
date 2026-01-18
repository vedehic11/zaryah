'use client'

import { AdminSellerManagementPage } from '@/app/components/AdminSellerManagementPage'
import { useAuth } from '@/app/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import toast from 'react-hot-toast'

export default function AdminSellersPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && user?.userType !== 'Admin') {
      toast.error('Admin access required')
      router.push('/')
    }
  }, [user, isLoading, router])

  return <AdminSellerManagementPage />
}
