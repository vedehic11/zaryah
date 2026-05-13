'use client'

import dynamic from 'next/dynamic'
import { Layout } from '../components/Layout'

const RegisterPage = dynamic(() => import('../components/RegisterPage').then(mod => mod.RegisterPage), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center min-h-screen">Loading...</div>
})

export default function Register() {
  return (
    <Layout>
      <RegisterPage />
    </Layout>
  )
}