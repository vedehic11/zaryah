'use client'

import { Suspense } from 'react'
import { Layout } from '../components/Layout'
import { ShopPage } from '../components/ShopPage'

export default function Shop() {
  return (
    <Layout>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div></div>}>
        <ShopPage />
      </Suspense>
    </Layout>
  )
}