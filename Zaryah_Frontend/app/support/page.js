'use client'

import { Layout } from '../components/Layout'
import { BuyerSupportPage } from '../components/BuyerSupportPage'
import { ProtectedRoute } from '../components/ProtectedRoute'

export default function Support() {
  return (
    <Layout>
      <ProtectedRoute>
        <BuyerSupportPage />
      </ProtectedRoute>
    </Layout>
  )
} 