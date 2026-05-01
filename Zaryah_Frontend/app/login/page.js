'use client'

import { Suspense } from 'react'
import { Layout } from '../components/Layout'
import { LoginPage } from '../components/LoginPage'

export default function Login() {
  return (
    <Layout>
      <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading login...</div>}>
        <LoginPage />
      </Suspense>
    </Layout>
  )
}