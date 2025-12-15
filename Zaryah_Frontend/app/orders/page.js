'use client'

import { Layout } from '../components/Layout'
import { OrderHistoryPage } from '../components/OrderHistoryPage'
import { ProtectedRoute } from '../components/ProtectedRoute'

export default function Orders() {
  return (
    <Layout>
      <ProtectedRoute>
        <OrderHistoryPage />
      </ProtectedRoute>
    </Layout>
  )
}