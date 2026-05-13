'use client'

import React, { Suspense } from 'react'
import { Layout } from '../../components/Layout'
import { AdminDashboardPage } from '../../components/AdminDashboardPage'
import { ProtectedRoute } from '../../components/ProtectedRoute'

// Render as a server component that wraps client components in Suspense.
export default function AdminDashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <Layout>
        <ProtectedRoute requiredRole="admin">
          <AdminDashboardPage />
        </ProtectedRoute>
      </Layout>
    </Suspense>
  )
}