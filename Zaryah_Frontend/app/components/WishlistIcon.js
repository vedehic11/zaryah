'use client'

import { Heart } from 'lucide-react'
import { useWishlist } from '../contexts/WishlistContext'
import Link from 'next/link'

export const WishlistIcon = () => {
  const { wishlistCount } = useWishlist()

  return (
    <Link
      href="/wishlist"
      className="relative p-2 rounded-full hover:bg-primary-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-300"
      aria-label="Open wishlist"
    >
      <Heart className="w-6 h-6 text-amber-700" />
      {wishlistCount > 0 && (
        <span className="absolute -top-1 -right-1 block h-5 w-5 rounded-full ring-2 ring-white bg-amber-700 text-xs text-white flex items-center justify-center font-semibold">
          {wishlistCount}
        </span>
      )}
    </Link>
  )
}
