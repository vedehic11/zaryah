'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, Play, Star, ShoppingBag, Gift, Package, Scale, Sparkles } from 'lucide-react'
import { InstantDeliveryBadge } from './InstantDeliveryBadge'
import { useCart } from '../contexts/CartContext'
import { useAuth } from '../contexts/AuthContext'
import { useWishlist } from '../contexts/WishlistContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export const ProductCard = ({ product }) => {
  const { user } = useAuth();
  const router = useRouter();
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const { addToCart } = useCart()
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist()
  
  const productId = product.id || product._id
  const isLiked = isInWishlist(productId)

  const checkAuthAndRedirect = () => {
    if (!user) {
      router.push('/login');
      return false;
    }
    return true;
  };

  const handleQuickAdd = (e) => {
    e.preventDefault() // Prevent navigation
    if (!checkAuthAndRedirect()) return;
    addToCart(product)
    toast.success('Added to cart!')
  }

  const handleGiftAdd = (e) => {
    e.preventDefault() // Prevent navigation
    if (!checkAuthAndRedirect()) return;
    addToCart(product, { giftPackaging: true })
    toast.success('Added as gift to cart!')
  }

  const handleLike = async (e) => {
    e.preventDefault() // Prevent navigation
    if (!checkAuthAndRedirect()) return;
    
    if (isLiked) {
      await removeFromWishlist(productId)
    } else {
      await addToWishlist(productId)
    }
  }

  // Calculate average rating from the ratings array
  const averageRating = product.averageRating || 0
  const totalReviews = product.ratings?.length || 0

  return (
    <div className="block h-full">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -8 }}
        className="bg-cream-50 rounded-2xl shadow-soft border border-primary-100 overflow-hidden flex flex-col h-full p-2 sm:p-4 lg:p-6 hover:shadow-medium transition-all duration-300"
        onHoverStart={() => setShowQuickAdd(true)}
        onHoverEnd={() => setShowQuickAdd(false)}
      >
        {/* Product Image */}
        <div className="relative overflow-hidden">
          <Link 
            href={productId ? `/product/${productId}` : '#'}
            className="block"
          >
            <img
              src={product.images && product.images.length > 0 ? product.images[0] : '/placeholder.jpg'}
              alt={product.name}
              className="w-full h-32 sm:h-48 lg:h-64 object-cover group-hover:scale-105 transition-transform duration-700 rounded-lg"
            />
          </Link>
          
          {/* Feature Badges */}
          <div className="absolute top-2 left-2 sm:top-4 sm:left-4 flex flex-col gap-2">
            {/* Instant Delivery Badge (only if seller and buyer are from the same city) */}
            {product.instantDelivery && user && user.city && product.seller && product.seller.city &&
              user.city.trim().toLowerCase() === product.seller.city.trim().toLowerCase() && (
                <InstantDeliveryBadge />
            )}
            
            {/* Customization Badge */}
            {product.customisable && (
              <div className="bg-secondary-600/90 backdrop-blur-sm text-white px-2 py-1 rounded-full shadow-soft flex items-center space-x-1">
                <Sparkles className="w-3 h-3" />
                <span className="text-xs font-medium">Custom</span>
              </div>
            )}
          </div>

          {/* Like Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleLike}
            className={`absolute top-2 right-2 sm:top-4 sm:right-4 z-20 backdrop-blur-sm p-2 sm:p-3 rounded-full transition-all shadow-soft ${
              isLiked 
                ? 'bg-amber-700 hover:bg-amber-800 border-amber-700' 
                : 'bg-white/90 hover:bg-white border-primary-200'
            } border`}
          >
            <Heart 
              className={`w-4 h-4 sm:w-5 sm:h-5 transition-all ${
                isLiked ? 'text-white fill-white' : 'text-amber-700'
              }`} 
            />
          </motion.button>

          {/* Quick Add Buttons - Desktop (Hover) */}
          <AnimatePresence>
            {showQuickAdd && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/50 to-transparent hidden lg:flex items-end justify-center pb-4 space-x-2"
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleQuickAdd}
                  className="bg-primary-600 hover:bg-primary-700 text-white p-3 rounded-full text-sm font-medium transition-all shadow-soft border border-primary-700 flex items-center justify-center"
                  title="Add to Cart"
                >
                  <ShoppingBag className="w-5 h-5 text-white" />
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleGiftAdd}
                  className="bg-secondary-600 hover:bg-secondary-700 text-white p-3 rounded-full text-sm font-medium transition-all shadow-soft border border-secondary-700 flex items-center justify-center"
                  title="Add as Gift"
                >
                  <Gift className="w-5 h-5 text-white" />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Product Info */}
        <div className="p-2 sm:p-4 flex-1 flex flex-col">
          <Link 
            href={productId ? `/product/${productId}` : '#'}
            className="flex-1"
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-bold text-charcoal-800 text-sm sm:text-base lg:text-lg line-clamp-2 leading-tight flex-1 mr-2 font-serif">
                {product.name}
              </h3>
              <div className="flex flex-col items-end gap-0">
                <span className="text-sm sm:text-lg lg:text-xl font-bold text-primary-700 whitespace-nowrap leading-tight">
                  ₹{product.price.toLocaleString()}
                </span>
                {product.mrp && product.mrp > product.price && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] sm:text-xs text-gray-500 line-through leading-none">
                      ₹{product.mrp.toLocaleString()}
                    </span>
                    <span className="text-[10px] sm:text-xs font-semibold text-orange-500 leading-none">
                      {Math.round(((product.mrp - product.price) / product.mrp) * 100)}% OFF
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Seller Info */}
            <div className="flex items-center space-x-1 mb-2">
              <span className="text-xs sm:text-sm text-charcoal-700">
                {product.seller?.businessName || 'Loading seller info...'}
              </span>
            </div>

            {/* Rating */}
            <div className="flex items-center space-x-1 mt-auto">
              <div className="flex items-center space-x-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-3 h-3 sm:w-4 sm:h-4 ${
                      i < Math.floor(averageRating) ? 'text-warm-500 fill-current' : 'text-charcoal-400'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs sm:text-sm text-charcoal-700 font-semibold">({averageRating})</span>
              <span className="text-xs text-charcoal-500 hidden sm:inline">• {totalReviews} reviews</span>
            </div>
          </Link>

          {/* Mobile Quick Add Buttons - Always Visible on Mobile */}
          <div className="flex space-x-2 mt-3 lg:hidden">
            <button
              onClick={handleQuickAdd}
              className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-lg text-sm font-medium transition-all shadow-soft border border-primary-700 flex items-center justify-center"
              title="Add to Cart"
            >
              <ShoppingBag className="w-5 h-5 text-white" />
            </button>
            
            <button
              onClick={handleGiftAdd}
              className="flex-1 bg-secondary-600 hover:bg-secondary-700 text-white py-2.5 rounded-lg text-sm font-medium transition-all shadow-soft border border-secondary-700 flex items-center justify-center"
              title="Add as Gift"
            >
              <Gift className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
