'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  Store, MapPin, Phone, Mail, Instagram, Facebook, Twitter, Linkedin,
  Star, Package, ShoppingBag, Award, Heart, TrendingUp, CheckCircle, Sparkles
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-elegant">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-200 border-t-primary-600 mx-auto mb-4"></div>
          <p className="text-charcoal-600 font-medium">Loading artisan profile...</p>
        </motion.div>
      </div>
    )
  }

  if (error || !seller || !isSeller) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-elegant">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md mx-auto px-4"
        >
          <div className="bg-white rounded-3xl shadow-xl p-8">
            <Store className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-charcoal-800 mb-3 font-serif">Artisan Not Found</h1>
            <p className="text-charcoal-600 mb-6">{error || 'The artisan you are looking for does not exist.'}</p>
            <Link href="/shop" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-secondary-600 text-white rounded-xl hover:shadow-lg transition-all">
              <ShoppingBag className="w-5 h-5" />
              Browse All Artisans
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }

  const user = seller.users || {}
  const stats = seller.stats || {}

  return (
    <div className="min-h-screen bg-gradient-elegant">
      {/* Cover Photo Section with Parallax Effect */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative h-56 md:h-72 lg:h-80 w-full overflow-hidden"
      >
        {seller.cover_photo ? (
          <div className="relative w-full h-full">
            {seller.cover_photo.match(/\.(mp4|webm|mov)$/i) ? (
              <video
                src={seller.cover_photo}
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
              />
            ) : (
              <Image
                src={seller.cover_photo}
                alt={`${seller.business_name} cover`}
                fill
                className="object-cover"
                priority
              />
            )}
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary-100 via-secondary-100 to-cream-100 flex items-center justify-center relative overflow-hidden">
            {/* Decorative Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-primary-400 blur-3xl"></div>
              <div className="absolute bottom-10 right-10 w-40 h-40 rounded-full bg-secondary-400 blur-3xl"></div>
              <div className="absolute top-1/2 left-1/3 w-36 h-36 rounded-full bg-accent-400 blur-3xl"></div>
            </div>
            <Store className="w-32 h-32 text-primary-300 relative z-10" />
          </div>
        )}
        
        {/* Elegant Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/70 via-charcoal-900/20 to-transparent" />
        
        {/* Verified Badge (if applicable) */}
        {user.is_approved && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
            className="absolute top-6 right-6 bg-white/95 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2"
          >
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm font-semibold text-charcoal-800">Verified Artisan</span>
          </motion.div>
        )}
      </motion.div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-10 pb-12">
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border border-cream-200"
        >
          {/* Profile Header */}
          <div className="px-4 sm:px-6 md:px-8 py-6 border-b border-cream-200 bg-gradient-to-br from-white to-cream-50">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
              {/* Profile Photo with Glow Effect */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="relative mx-auto md:mx-0"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary-400 to-secondary-400 rounded-full blur-xl opacity-30 scale-110"></div>
                <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center overflow-hidden border-4 border-white shadow-xl">
                  {user.profile_photo ? (
                    <Image
                      src={user.profile_photo}
                      alt={seller.business_name}
                      width={128}
                      height={128}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <Store className="w-12 h-12 md:w-16 md:h-16 text-white" />
                  )}
                </div>
              </motion.div>

              {/* Seller Info */}
              <div className="flex-1 w-full">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 md:gap-4">
                  <div className="flex-1">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h1 className="text-2xl md:text-3xl font-bold text-charcoal-900 font-serif">
                              {seller.business_name}
                            </h1>
                            {user.is_approved && (
                              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-charcoal-500 font-medium mt-1">@{seller.username}</p>
                        </div>
                        
                        {/* Rating Badge */}
                        <div className="flex items-center gap-1.5 bg-yellow-50 px-3 py-1.5 rounded-full border border-yellow-200 w-fit">
                          <Star className="w-4 h-4 text-yellow-600 fill-yellow-600" />
                          <span className="text-sm font-bold text-yellow-900">
                            {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '0.0'}
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-sm md:text-base text-charcoal-600 mb-3 leading-relaxed">
                        {seller.business_description}
                      </p>

                      {/* Artisan Story Section */}
                      {seller.story && (
                        <div className="mt-3 p-4 bg-gradient-to-br from-cream-50 to-primary-50 rounded-xl border border-primary-100">
                          <h3 className="text-base md:text-lg font-bold text-primary-700 mb-1.5 flex items-center gap-2">
                            <Heart className="w-4 h-4" />
                            My Story
                          </h3>
                          <p className="text-sm text-charcoal-700 leading-relaxed">
                            {seller.story}
                          </p>
                        </div>
                      )}
                    </motion.div>
                    
                    {/* Location & Contact */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6 }}
                      className="flex flex-wrap gap-2 mt-3 text-sm text-charcoal-600"
                    >
                      {seller.city && (
                        <div className="flex items-center gap-1.5 bg-cream-100 px-3 py-1.5 rounded-full">
                          <MapPin className="w-3.5 h-3.5 text-primary-600" />
                          <span className="font-medium text-xs">{seller.city}</span>
                        </div>
                      )}
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Products Section */}
          <div className="px-4 sm:px-6 md:px-8 py-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-charcoal-900 mb-1 font-serif">
                    Handcrafted Collection
                  </h2>
                  <p className="text-sm text-charcoal-600">Discover unique pieces by {seller.business_name}</p>
                </div>
              </div>

              {seller.products && seller.products.length > 0 ? (
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={{
                    visible: {
                      transition: {
                        staggerChildren: 0.1
                      }
                    }
                  }}
                  className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6"
                >
                  {seller.products.map((product, index) => (
                    <motion.div
                      key={product.id}
                      variants={{
                        hidden: { opacity: 0, y: 20 },
                        visible: { opacity: 1, y: 0 }
                      }}
                    >
                      <ProductCard product={product} />
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <div className="text-center py-12 bg-gradient-to-br from-cream-50 to-primary-50 rounded-2xl border-2 border-dashed border-cream-300">
                  <Package className="w-16 h-16 text-cream-400 mx-auto mb-3" />
                  <p className="text-charcoal-600 text-base font-medium">No products available yet</p>
                  <p className="text-charcoal-500 text-sm mt-1">Check back soon for amazing handcrafted items!</p>
                </div>
              )}

              {seller.products && seller.products.length >= 20 && (
                <div className="mt-8 text-center">
                  <Link
                    href={`/shop?seller=${username}`}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-secondary-600 text-white text-base font-semibold rounded-xl hover:shadow-xl hover:scale-105 transition-all"
                  >
                    <ShoppingBag className="w-5 h-5" />
                    View All Products
                  </Link>
                </div>
              )}
            </motion.div>
          </div>

          {/* Connect with us on Instagram at the end */}
          {seller.instagram && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="px-4 sm:px-6 md:px-8 py-6 border-t border-cream-200 bg-gradient-to-br from-primary-50 to-cream-50"
            >
              <div className="text-center">
                <h3 className="text-lg md:text-xl font-bold text-charcoal-900 mb-2 font-serif">Connect with us on Instagram</h3>
                <p className="text-sm text-charcoal-600 mb-4">Follow us for updates and exclusive offers</p>
                <a
                  href={`https://instagram.com/${seller.instagram.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg hover:shadow-xl text-white rounded-xl hover:scale-105 transition-all font-semibold text-base"
                >
                  <Instagram className="w-5 h-5" />
                  <span>@{seller.instagram.replace('@', '')}</span>
                </a>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

