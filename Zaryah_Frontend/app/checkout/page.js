import { Suspense } from 'react'
import CheckoutClient from './CheckoutClient'

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <CheckoutClient />
    </Suspense>
  )
}
