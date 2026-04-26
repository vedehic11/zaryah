import { Suspense } from 'react'
import { WishlistPage } from '../components/WishlistPage'

export default function Wishlist() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream-50 to-primary-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      }
    >
      <WishlistPage />
    </Suspense>
  )
}
