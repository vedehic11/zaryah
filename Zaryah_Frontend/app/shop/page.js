'use client'

import dynamic from 'next/dynamic'
import { Layout } from '../components/Layout'

const ShopPage = dynamic(() => import('../components/ShopPage').then(mod => mod.ShopPage), {
  ssr: false,
  loading: () => <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div></div>
})

export default function Shop() {
  return (
    <Layout>
      <ShopPage />
    </Layout>
  )
}