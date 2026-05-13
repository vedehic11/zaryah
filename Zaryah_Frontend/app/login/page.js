'use client'

import dynamic from 'next/dynamic'
import { Layout } from '../components/Layout'

const LoginPage = dynamic(() => import('../components/LoginPage').then(mod => mod.LoginPage), {
  ssr: false,
  loading: () => <div className="p-6 text-sm text-gray-500">Loading login...</div>
})

export default function Login() {
  return (
    <Layout>
      <LoginPage />
    </Layout>
  )
}