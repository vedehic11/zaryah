'use client'

import { Layout } from '../../components/Layout'
import { AdminDashboardPage } from '../../components/AdminDashboardPage'
import { ProtectedRoute } from '../../components/ProtectedRoute'

export default function AdminDashboard() {
  return (
    <Layout>
      <ProtectedRoute requiredRole="admin">
        <AdminDashboardPage />
      </ProtectedRoute>
    </Layout>
  )
}