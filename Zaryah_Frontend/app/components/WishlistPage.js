'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Heart, ShoppingBag, Trash2, Search, X, ChevronLeft } from 'lucide-react'
import { useWishlist } from '../contexts/WishlistContext'
import { useCart } from '../contexts/CartContext'
import { useAuth } from '../contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

export const WishlistPage = () => {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const { wishlist, loading, removeFromWishlist, fetchWishlist } = useWishlist()
  const { addToCart } = useCart()
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredWishlist, setFilteredWishlist] = useState([])

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  useEffect(() => {
    if (user) {
      fetchWishlist()
    }
  }, [user])

  // Filter wishlist based on search
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredWishlist(wishlist)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = wishlist.filter(item => 
        item.product?.name?.toLowerCase().includes(query) ||
        item.product?.seller?.business_name?.toLowerCase().includes(query)
      )
      setFilteredWishlist(filtered)
    }
  }, [searchQuery, wishlist])

  const handleRemove = async (productId) => {
    await removeFromWishlist(productId)
  }

  const handleAddToCart = (product) => {
    addToCart(product)
    toast.success('Added to cart!')
  }

  const handleMoveToCart = async (product) => {
    addToCart(product)
    await removeFromWishlist(product.id)
    toast.success('Moved to cart!')
  }

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream-50 to-primary-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 to-primary-50 py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with Back Button */}
        <div className="mb-6 sm:mb-8">
          {/* Title Row with Back Button */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => router.back()}
              className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-sm hover:shadow-md transition-shadow"
              aria-label="Go back"
            >
              <ChevronLeft className="w-6 h-6 text-charcoal-800" />
            </button>
            <Heart className="w-7 h-7 sm:w-8 sm:h-8 text-amber-700 fill-amber-700 flex-shrink-0" />
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-charcoal-800 font-serif">
                My Wishlist
              </h1>
              <p className="text-xs sm:text-sm text-charcoal-600 mt-0.5">
                {wishlist.length} {wishlist.length === 1 ? 'item' : 'items'} saved
              </p>
            </div>
          </div>

          {/* Search Bar */}
          {wishlist.length > 0 && (
            <div className="relative w-full sm:w-64 md:w-80">
              <input
                type="text"
                placeholder="Search artisan or product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-primary-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-charcoal-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Search Results Info */}
          {searchQuery && (
            <p className="text-sm text-charcoal-600 mt-3">
              {filteredWishlist.length === 0 ? (
                <span className="text-red-600">No items found matching "{searchQuery}"</span>
              ) : (
                <span>Showing {filteredWishlist.length} of {wishlist.length} items</span>
              )}
            </p>
          )}
        </div>

        {wishlist.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-soft p-8 sm:p-12 text-center border border-primary-100"
          >
            <Heart className="w-16 h-16 sm:w-20 sm:h-20 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl sm:text-2xl font-bold text-charcoal-800 mb-2">Your wishlist is empty</h2>
            <p className="text-sm sm:text-base text-charcoal-600 mb-6">
              Start adding your favorite products to your wishlist
            </p>
            <Link
              href="/shop"
              className="inline-block bg-primary-600 hover:bg-primary-700 text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-medium transition-all shadow-soft"
            >
              Browse Products
            </Link>
          </motion.div>
        ) : filteredWishlist.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-soft p-8 sm:p-12 text-center border border-primary-100"
          >
            <Search className="w-16 h-16 sm:w-20 sm:h-20 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl sm:text-2xl font-bold text-charcoal-800 mb-2">No results found</h2>
            <p className="text-sm sm:text-base text-charcoal-600 mb-4">
              No items match your search for "{searchQuery}"
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="text-primary-600 hover:text-primary-700 font-medium text-sm sm:text-base"
            >
              Clear search
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredWishlist.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ y: -8 }}
                className="bg-cream-50 rounded-2xl shadow-soft border border-primary-100 overflow-hidden flex flex-col h-full p-2 sm:p-4 lg:p-6 hover:shadow-medium transition-all duration-300"
              >
                {/* Product Image */}
                <div className="relative overflow-hidden">
                  <Link href={`/product/${item.product_id}`}>
                    <img
                      src={item.product?.images?.[0] || '/placeholder.jpg'}
                      alt={item.product?.name}
                      className="w-full h-32 sm:h-48 lg:h-64 object-cover group-hover:scale-105 transition-transform duration-700 rounded-lg"
                    />
                  </Link>

                  {/* Stock Badge */}
                  {item.product?.stock === 0 && (
                    <div className="absolute top-2 left-2 sm:top-4 sm:left-4 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium shadow-soft">
                      Out of Stock
                    </div>
                  )}

                  {/* Remove Button */}
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleRemove(item.product_id)}
                    className="absolute top-2 right-2 sm:top-4 sm:right-4 z-20 bg-white/90 hover:bg-red-50 backdrop-blur-sm p-2 sm:p-3 rounded-full transition-all shadow-soft border border-gray-200"
                    title="Remove from wishlist"
                  >
                    <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
                  </motion.button>
                </div>

                {/* Product Info */}
                <div className="p-2 sm:p-4 flex-1 flex flex-col">
                  <Link href={`/product/${item.product_id}`} className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-charcoal-800 text-sm sm:text-base lg:text-lg line-clamp-2 leading-tight flex-1 mr-2 font-serif">
                        {item.product?.name}
                      </h3>
                      <div className="flex flex-col items-end gap-0">
                        <span className="text-sm sm:text-lg lg:text-xl font-bold text-primary-700 whitespace-nowrap leading-tight">
                          ₹{item.product?.price.toLocaleString()}
                        </span>
                        {item.product?.mrp && item.product.mrp > item.product.price && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] sm:text-xs text-gray-500 line-through leading-none">
                              ₹{item.product.mrp.toLocaleString()}
                            </span>
                            <span className="text-[10px] sm:text-xs font-semibold text-orange-500 leading-none">
                              {Math.round(((item.product.mrp - item.product.price) / item.product.mrp) * 100)}% OFF
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Seller Info */}
                    <div className="flex items-center space-x-1 mb-2">
                      <span className="text-xs sm:text-sm text-charcoal-700">
                        {item.product?.seller?.business_name || 'Seller'}
                      </span>
                    </div>
                  </Link>

                  {/* Move to Cart Button */}
                  <div className="mt-3">
                    <button
                      onClick={() => handleMoveToCart(item.product)}
                      disabled={item.product?.stock === 0}
                      className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all shadow-soft flex items-center justify-center space-x-2 ${
                        item.product?.stock === 0
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                          : 'bg-primary-600 hover:bg-primary-700 text-white border border-primary-700'
                      }`}
                    >
                      <ShoppingBag className="w-5 h-5" />
                      <span>Move to Cart</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Continue Shopping */}
        {wishlist.length > 0 && (
          <div className="text-center mt-8">
            <Link
              href="/shop"
              className="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium transition-colors"
            >
              Continue Shopping
              <svg
                className="w-4 h-4 ml-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
