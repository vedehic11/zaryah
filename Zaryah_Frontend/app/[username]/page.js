'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  Store, MapPin, Phone, Mail, Instagram, Facebook, Twitter, Linkedin,
  Star, Package, ShoppingBag
} from 'lucide-react'
import { ProductCard } from '@/app/components/ProductCard'
import Link from 'next/link'
import Image from 'next/image'

export default function SellerProfilePage({ params }) {
  const { username } = use(params)
  const router = useRouter()
  const [seller, setSeller] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isSeller, setIsSeller] = useState(false)

  useEffect(() => {
    const fetchSeller = async () => {
      try {
        setLoading(true)
        
        // First check if this is a reserved route
        const reservedRoutes = ['shop', 'product', 'login', 'register', 'admin', 'seller', 'orders', 'cart', 'support', 'gift-suggester', 'hamper-builder']
        if (reservedRoutes.includes(username)) {
          // This is a reserved route, redirect to 404 or home
          router.push('/')
          return
        }

        const response = await fetch(`/api/sellers/username/${username}`)
        const data = await response.json()

        if (!response.ok) {
          // Not a seller username, could be a 404 or other route
          if (response.status === 404) {
            setError('Seller not found')
            setIsSeller(false)
          } else {
            throw new Error(data.error || 'Error loading seller')
          }
          return
        }

        setSeller(data)
        setIsSeller(true)
      } catch (err) {
        setError(err.message)
        setIsSeller(false)
      } finally {
        setLoading(false)
      }
    }

    if (username) {
      fetchSeller()
    }
  }, [username, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (error || !seller || !isSeller) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Seller Not Found</h1>
          <p className="text-gray-600 mb-4">{error || 'The seller you are looking for does not exist.'}</p>
          <Link href="/shop" className="text-primary-600 hover:text-primary-700">
            Browse All Sellers
          </Link>
        </div>
      </div>
    )
  }

  const user = seller.users || {}
  const stats = seller.stats || {}

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Cover Photo Section */}
      <div className="relative h-64 md:h-80 lg:h-96 w-full overflow-hidden bg-gradient-to-br from-primary-100 to-secondary-100">
        {seller.cover_photo ? (
          <Image
            src={seller.cover_photo}
            alt={`${seller.business_name} cover`}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Store className="w-24 h-24 text-primary-300" />
          </div>
        )}
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      </div>

      {/* Seller Info Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-10">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Profile Header */}
          <div className="px-6 py-8 border-b border-gray-200">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              {/* Profile Photo */}
              <div className="relative">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
                  {user.profile_photo ? (
                    <Image
                      src={user.profile_photo}
                      alt={seller.business_name}
                      width={128}
                      height={128}
                      className="object-cover"
                    />
                  ) : (
                    <Store className="w-16 h-16 text-white" />
                  )}
                </div>
              </div>

              {/* Seller Info */}
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                      {seller.business_name}
                    </h1>
                    <p className="text-lg text-gray-600 mb-4">
                      {seller.business_description}
                    </p>
                    
                    {/* Stats */}
                    <div className="flex flex-wrap gap-6 mb-4">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Package className="w-5 h-5 text-primary-600" />
                        <span className="font-semibold">{stats.productsCount || 0}</span>
                        <span className="text-sm">Products</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-700">
                        <ShoppingBag className="w-5 h-5 text-primary-600" />
                        <span className="font-semibold">{stats.ordersCount || 0}</span>
                        <span className="text-sm">Orders</span>
                      </div>
                      {stats.averageRating > 0 && (
                        <div className="flex items-center gap-2 text-gray-700">
                          <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                          <span className="font-semibold">{stats.averageRating}</span>
                          <span className="text-sm">Rating</span>
                        </div>
                      )}
                    </div>

                    {/* Location & Contact */}
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      {seller.city && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>{seller.city}</span>
                        </div>
                      )}
                      {seller.primary_mobile && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          <span>{seller.primary_mobile}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Social Media Links */}
          {(seller.instagram || seller.facebook || seller.x || seller.linkedin) && (
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">Follow us:</span>
                {seller.instagram && (
                  <a
                    href={`https://instagram.com/${seller.instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-pink-600 hover:text-pink-700 transition-colors"
                  >
                    <Instagram className="w-5 h-5" />
                  </a>
                )}
                {seller.facebook && (
                  <a
                    href={`https://facebook.com/${seller.facebook.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <Facebook className="w-5 h-5" />
                  </a>
                )}
                {seller.x && (
                  <a
                    href={`https://twitter.com/${seller.x.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-900 hover:text-gray-700 transition-colors"
                  >
                    <Twitter className="w-5 h-5" />
                  </a>
                )}
                {seller.linkedin && (
                  <a
                    href={`https://linkedin.com/in/${seller.linkedin.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 hover:text-blue-800 transition-colors"
                  >
                    <Linkedin className="w-5 h-5" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Products Section */}
          <div className="px-6 py-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Products by {seller.business_name}
            </h2>

            {seller.products && seller.products.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {seller.products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No products available yet</p>
              </div>
            )}

            {seller.products && seller.products.length >= 20 && (
              <div className="mt-8 text-center">
                <Link
                  href={`/shop?seller=${username}`}
                  className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors"
                >
                  View All Products
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}





