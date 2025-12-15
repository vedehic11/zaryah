'use client'

import { Layout } from '../../components/Layout'
import SellerDashboardPage from '../../components/SellerDashboardPage'
import { ProtectedRoute } from '../../components/ProtectedRoute'

export default function SellerDashboard() {
  return (
    <Layout>
      <ProtectedRoute requiredRole="seller">
        <SellerDashboardPage />
      </ProtectedRoute>
    </Layout>
  )
}