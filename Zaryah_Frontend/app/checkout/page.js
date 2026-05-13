'use client'

import dynamic from 'next/dynamic'

const CheckoutClient = dynamic(() => import('./CheckoutClient'), {
  ssr: false,
  loading: () => <div className="min-h-screen flex items-center justify-center">Loading...</div>
})

export default function CheckoutPage() {
  return <CheckoutClient />
}
