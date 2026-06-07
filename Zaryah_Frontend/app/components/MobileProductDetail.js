'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Heart, Share2, ShoppingBag, MapPin, CheckCircle, Shield, AlertCircle, Search, Package, Truck, RotateCcw, Sparkles, Star, Image as ImageIcon, Gift, Menu, X } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCart } from '../contexts/CartContext'
import { useWishlist } from '../contexts/WishlistContext'
import { CartSidebar } from './CartSidebar'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'react-hot-toast'
import { Reviews } from './Reviews'
import Image from 'next/image'
import { formatWeightDisplay } from '@/lib/weight'
import { getSellerUrl, getMainDomainUrl } from '@/lib/url-utils'
import { apiService } from '../services/api'

export default function MobileProductDetail({ product, similarProducts = [] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { addToCart, setIsCartOpen } = useCart()
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist()
  const { user, logout } = useAuth()
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const touchStartX = useRef(null)
  const touchCurrentX = useRef(null)
  const [selectedSize, setSelectedSize] = useState(null)
  const [selectedColor, setSelectedColor] = useState(null)
  const [customizationAnswers, setCustomizationAnswers] = useState({})
  const [customUploadStatus, setCustomUploadStatus] = useState({})
  const [activeTab, setActiveTab] = useState('details')
  const [sellerUsername, setSellerUsername] = useState(null)
  const [galleryReady, setGalleryReady] = useState(false)
  const thumbsRefMobile = useRef(null)

  // Derive seller username with fallback logic and fetch from API if needed
  useEffect(() => {
    const deriveSellerUsername = async () => {
      // Try to get from product seller object
      let username = product?.seller?.username || 
                     product?.seller?.sellerUsername || 
                     product?.seller?.seller_username
      
      if (username) {
        console.log('✓ Using seller username from product:', username)
        setSellerUsername(username)
        return
      }
      
      // If not available, fetch from sellers API
      if (product?.seller?.id || product?.seller_id) {
        try {
          const sellerId = product?.seller?.id || product?.seller_id
          const response = await fetch(`/api/sellers?id=${sellerId}`)
          if (response.ok) {
            const seller = await response.json()
            if (seller.username) {
              console.log('✓ Fetched seller username from API:', seller.username)
              setSellerUsername(seller.username)
              return
            }
          }
        } catch (err) {
          console.error('Failed to fetch seller username:', err)
        }
      }
      
      console.warn('⚠ No seller username available')
      setSellerUsername(null)
    }
    
    if (product) {
      deriveSellerUsername()
    }
  }, [product])
  const isTwoWayDelivery = Boolean(product?.twoWayDelivery || product?.two_way_delivery)
  const backTarget = String(searchParams.get('back') || '').trim()
  const safeBackTarget = backTarget.startsWith('/') || backTarget.startsWith('http') ? backTarget : ''
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const sizePriceOptions = Array.isArray(product?.sizePriceOptions)
    ? product.sizePriceOptions
    : Array.isArray(product?.size_price_options)
      ? product.size_price_options
      : []

  const sizeOptions = sizePriceOptions.length > 0
    ? sizePriceOptions.map(option => option?.label).filter(Boolean)
    : Array.isArray(product?.sizeOptions)
      ? product.sizeOptions
      : []

  const colorOptions = Array.isArray(product?.colorOptions)
    ? product.colorOptions
    : Array.isArray(product?.color_options)
      ? product.color_options
      : []

  const parseSizeCharts = (p) => {
    try {
      if (Array.isArray(p?.sizeCharts)) return p.sizeCharts
      if (typeof p?.sizeCharts === 'string') {
        const parsed = JSON.parse(p.sizeCharts)
        if (Array.isArray(parsed)) return parsed
      }
      if (Array.isArray(p?.size_charts)) return p.size_charts
      if (typeof p?.size_charts === 'string') {
        const parsed = JSON.parse(p.size_charts)
        if (Array.isArray(parsed)) return parsed
      }
    } catch (err) {
      console.error('Failed to parse size_charts for product', err)
    }
    return []
  }

  const sizeCharts = parseSizeCharts(product)
  const productId = product?.id || product?._id
  const isWishlisted = productId ? isInWishlist(productId) : false

  const selectedSizePrice = sizePriceOptions.find(option => option?.label === selectedSize)?.price
  const displayPrice = selectedSizePrice !== undefined && selectedSizePrice !== null
    ? Number(selectedSizePrice)
    : Number(product?.price || 0)

  const selectedColorImage = colorOptions.find(option => option?.name === selectedColor)?.image
  const baseImages = Array.isArray(product?.images) && product.images.length > 0
    ? product.images
    : product?.image
      ? [product.image]
      : []
  const displayImages = selectedColorImage ? [selectedColorImage, ...baseImages] : baseImages

  const handleBack = () => {
    if (safeBackTarget) {
      if (safeBackTarget.startsWith('http') && typeof window !== 'undefined') {
        window.location.href = safeBackTarget
        return
      }
      router.push(safeBackTarget)
      return
    }

    if (sellerUsername) {
      if (typeof window !== 'undefined') {
        window.location.href = getSellerUrl(sellerUsername)
      }
      return
    }

    router.back()
  }

  const handleLogout = async () => {
    await logout()
    window.location.href = getMainDomainUrl('/')
  }

  const handleViewCart = () => {
    setIsCartOpen(true)
  }

  const checkAuthAndRedirect = () => {
    if (!user) {
      router.push('/login')
      return false
    }
    return true
  }

  const goToSellerProfile = () => {
    if (!sellerUsername) return
    if (typeof window !== 'undefined') {
      window.location.href = getSellerUrl(sellerUsername)
    }
  }

  useEffect(() => {
    if (sizeOptions.length > 0) {
      setSelectedSize(sizeOptions[0])
    } else {
      setSelectedSize(null)
    }

    if (colorOptions.length > 0) {
      setSelectedColor(colorOptions[0]?.name || null)
    } else {
      setSelectedColor(null)
    }

    setCurrentImageIndex(0)
    setGalleryReady(false)

    if (product?.customisable && (product?.customQuestions || product?.custom_questions)) {
      console.log('Customization enabled:', product.customisable)
      console.log('Custom questions:', product.customQuestions || product.custom_questions)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id])

  useEffect(() => {
    setCurrentImageIndex(0)
    setGalleryReady(false)
  }, [selectedColor])

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-500">Product not found</p>
      </div>
    )
  }


  const discount = product.mrp && displayPrice < product.mrp
    ? Math.round(((product.mrp - displayPrice) / product.mrp) * 100)
    : 0

  const customizationQuestions = Array.isArray(product?.customQuestions)
    ? product.customQuestions
    : Array.isArray(product?.custom_questions)
      ? product.custom_questions
      : []

  const handleAddToCart = async () => {
    // Validate customization questions if product is customizable
    if (product.customisable && customizationQuestions.length > 0) {
      const unanswered = customizationQuestions.some((q, index) => {
        // Only validate required questions (those with asterisk)
        if (q.required === false) return false
        
        const questionType = q.answerType || q.type || 'text'
        const answer = customizationAnswers[index]
        if (questionType === 'photo') {
          return !answer || customUploadStatus[index]
        }
        return !answer || answer.trim() === ''
      })
      if (unanswered) {
        toast.error('Please answer all required customization questions before adding to bag')
        return
      }
    }
    
    try {
      const customizations = product.customisable && customizationQuestions.length > 0 
        ? customizationQuestions.map((q, index) => ({
            question: q.question,
            answer: customizationAnswers[index],
            answerType: q.answerType || q.type || 'text'
          }))
        : []
      
      await addToCart(product, { 
        quantity: 1, 
        selectedSize,
        selectedColor,
        unitPrice: displayPrice,
        customizations 
      })
      toast.success('Added to bag!')
    } catch (error) {
      toast.error(error.message || 'Failed to add to bag')
    }
  }

  const handleBuyNow = async () => {
    if (!user) {
      router.push('/login')
      return
    }

    // Validate customization questions if product is customizable
    if (product.customisable && customizationQuestions.length > 0) {
      const unanswered = customizationQuestions.some((q, index) => {
        if (q.required === false) return false
        
        const questionType = q.answerType || q.type || 'text'
        const answer = customizationAnswers[index]
        if (questionType === 'photo') {
          return !answer || customUploadStatus[index]
        }
        return !answer || answer.trim() === ''
      })
      if (unanswered) {
        toast.error('Please answer all required customization questions before buying')
        return
      }
    }

    try {
      const customizations = product.customisable && customizationQuestions.length > 0 
        ? customizationQuestions.map((q, index) => ({
            question: q.question,
            answer: customizationAnswers[index],
            answerType: q.answerType || q.type || 'text'
          }))
        : []

      // Prepare a single buy-now item and store in session so Checkout can read it
      const buyNowItem = {
        id: product.id || product._id,
        name: product.name,
        images: product.images || (product.image ? [product.image] : []),
        unitPrice: displayPrice,
        price: displayPrice,
        quantity: 1,
        selectedSize,
        selectedColor,
        customizations,
        giftPackaging: false,
        cartItemId: `buyNow_${Date.now()}`
      }

      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('zaryah-buyNowItem', JSON.stringify(buyNowItem))
        } catch (e) {
          console.error('Failed to save buyNow item to sessionStorage', e)
        }
        const redirect = encodeURIComponent(window.location.href)
        router.push(`/checkout?buyNow=1&redirect=${redirect}`)
      } else {
        router.push('/checkout?buyNow=1')
      }
    } catch (error) {
      toast.error(error.message || 'Failed to proceed')
    }
  }

  const handlePhotoAnswerUpload = async (questionIndex, file) => {
    if (!file) return

    const isValidType = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)
    const isValidSize = file.size <= 5 * 1024 * 1024

    if (!isValidType) {
      toast.error('Only JPG, PNG, GIF, or WebP images are allowed')
      return
    }

    if (!isValidSize) {
      toast.error('Image must be 5MB or smaller')
      return
    }

    setCustomUploadStatus(prev => ({ ...prev, [questionIndex]: true }))

    try {
      const uploadData = new FormData()
      uploadData.append('file', file)
      uploadData.append('folder', 'product-custom-answers')

      const response = await apiService.request('/upload', {
        method: 'POST',
        body: uploadData
      })

      if (!response?.url) {
        throw new Error('Failed to upload image')
      }

      setCustomizationAnswers(prev => ({
        ...prev,
        [questionIndex]: response.url
      }))
      toast.success('Photo uploaded')
    } catch (error) {
      toast.error(error.message || 'Failed to upload image')
    } finally {
      setCustomUploadStatus(prev => ({ ...prev, [questionIndex]: false }))
    }
  }

  const toggleWishlist = async () => {
    if (!checkAuthAndRedirect()) return
    if (!productId) return

    if (isWishlisted) {
      await removeFromWishlist(productId)
      toast.success('Removed from wishlist')
    } else {
      await addToWishlist(productId)
      toast.success('Added to wishlist')
    }
  }

  const handleOpenWishlist = () => {
    router.push('/wishlist')
  }

  const handleShare = async () => {
    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        toast.error('Share not available');
        return;
      }

      const shareUrl = window.location.href;
      const shareData = {
        title: product?.name || 'Product',
        text: `Check out this amazing product: ${product?.name || 'Unknown'}`,
        url: shareUrl,
      };

      // Try native share first
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share(shareData);
          return;
        } catch (err) {
          // User cancelled or share failed, try clipboard
          console.log('Native share cancelled or failed', err);
        }
      }

      // Fallback to clipboard
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard!');
      } else {
        // Last resort: use old copyToClipboard method
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        toast.success('Link copied to clipboard!');
      }
    } catch (error) {
      console.error('Share error:', error);
      toast.error('Unable to share. Please try again.');
    }
  };

  // Calculate estimated delivery date
  const deliveryDate = new Date()
  deliveryDate.setDate(deliveryDate.getDate() + (product.delivery_time_max || 7))
  const deliveryDateStr = deliveryDate.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  })

  return (
    <div className="min-h-screen bg-cream-50 md:hidden">
      {/* Header - Myntra Style */}
      <div className="sticky top-0 z-50 bg-cream-50 border-b border-primary-200 shadow-sm">
        <div className="flex items-center px-3 py-2.5 space-x-2">
          <div className="flex-1 flex items-center bg-white border border-primary-200 rounded-md px-3 py-2">
            <div className="w-5 h-5 mr-2 text-primary-700 font-bold flex items-center justify-center">
              <span className="text-lg">z</span>
            </div>
            <input
              type="text"
              placeholder="Search for products"
              className="flex-1 bg-transparent text-sm text-charcoal-500 outline-none placeholder-charcoal-400"
              readOnly
            />
            <Search className="w-5 h-5 text-charcoal-600" />
          </div>
          
          <button 
            onClick={handleOpenWishlist}
            className="p-1.5 active:bg-primary-100 rounded-full transition-colors"
            aria-label="Open wishlist"
          >
            <Heart className="w-6 h-6 text-charcoal-800" strokeWidth={2} />
          </button>
          
          <button 
            onClick={handleViewCart}
            className="p-1.5 active:bg-primary-100 rounded-full transition-colors"
            aria-label="View cart"
          >
            <ShoppingBag className="w-6 h-6 text-charcoal-800" strokeWidth={2} />
          </button>
          
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-1 active:bg-primary-100 rounded-full transition-colors"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="w-6 h-6 text-charcoal-800" /> : <Menu className="w-6 h-6 text-charcoal-800" />}
          </button>
        </div>
        
        <AnimatePresence>
          {isMenuOpen && (
            <>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="fixed inset-0 z-40 bg-black/40"
                aria-label="Close menu"
              />
              <motion.aside
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="fixed inset-y-0 right-0 z-50 w-72 max-w-[86%] border-l border-primary-200 bg-cream-50/95 text-charcoal-900 backdrop-blur-xl shadow-2xl overflow-y-auto"
              >
                <div className="flex items-center justify-between border-b border-primary-200 px-4 py-4">
                  <h3 className="text-base font-semibold">Quick Menu</h3>
                  <button
                    type="button"
                    onClick={() => setIsMenuOpen(false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary-200 bg-white hover:bg-cream-100 transition-colors"
                    aria-label="Close menu"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-2 p-4">
                  {sellerUsername && (
                    <button
                      onClick={() => {
                        window.location.href = getSellerUrl(sellerUsername)
                        setIsMenuOpen(false)
                      }}
                      className="w-full text-left rounded-xl px-3 py-2 text-sm font-medium hover:bg-primary-50 transition-colors"
                    >
                      Visit Seller
                    </button>
                  )}
                  <button
                    onClick={() => {
                      window.location.href = getMainDomainUrl('/')
                      setIsMenuOpen(false)
                    }}
                    className="w-full text-left rounded-xl px-3 py-2 text-sm font-medium hover:bg-primary-50 transition-colors"
                  >
                    Zaryah Home
                  </button>
                  <button
                    onClick={() => {
                      window.location.href = getMainDomainUrl('/shop')
                      setIsMenuOpen(false)
                    }}
                    className="w-full text-left rounded-xl px-3 py-2 text-sm font-medium hover:bg-primary-50 transition-colors"
                  >
                    Shop
                  </button>
                  {user && (
                    <>
                      <button
                        onClick={() => {
                          window.location.href = getMainDomainUrl('/orders')
                          setIsMenuOpen(false)
                        }}
                        className="w-full text-left rounded-xl px-3 py-2 text-sm font-medium hover:bg-primary-50 transition-colors"
                      >
                        Orders
                      </button>
                      <button
                        onClick={() => {
                          window.location.href = getMainDomainUrl('/support')
                          setIsMenuOpen(false)
                        }}
                        className="w-full text-left rounded-xl px-3 py-2 text-sm font-medium hover:bg-primary-50 transition-colors"
                      >
                        Support
                      </button>
                      <button
                        onClick={() => {
                          window.location.href = getMainDomainUrl('/wishlist')
                          setIsMenuOpen(false)
                        }}
                        className="w-full text-left rounded-xl px-3 py-2 text-sm font-medium hover:bg-primary-50 transition-colors"
                      >
                        Wishlist
                      </button>
                      <button
                        onClick={() => {
                          window.location.href = getMainDomainUrl('/addresses')
                          setIsMenuOpen(false)
                        }}
                        className="w-full text-left rounded-xl px-3 py-2 text-sm font-medium hover:bg-primary-50 transition-colors"
                      >
                        Profile Details
                      </button>
                      <button
                        onClick={() => {
                          handleLogout()
                          setIsMenuOpen(false)
                        }}
                        className="w-full text-left rounded-xl px-3 py-2 text-sm font-medium hover:bg-primary-50 transition-colors"
                      >
                        Logout
                      </button>
                    </>
                  )}
                  {!user && (
                    <button
                      onClick={() => {
                        window.location.href = getMainDomainUrl('/login')
                        setIsMenuOpen(false)
                      }}
                      className="w-full text-left rounded-xl px-3 py-2 text-sm font-medium hover:bg-primary-50 transition-colors"
                    >
                      Login / Register
                    </button>
                  )}
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Image Carousel */}
      <div
        className="relative bg-white"
        onTouchStart={(e) => {
          touchStartX.current = e.touches?.[0]?.clientX ?? null
          touchCurrentX.current = null
        }}
        onTouchMove={(e) => {
          touchCurrentX.current = e.touches?.[0]?.clientX ?? null
        }}
        onTouchEnd={() => {
          try {
            if (touchStartX.current == null || touchCurrentX.current == null) return
            const delta = touchStartX.current - touchCurrentX.current
            const threshold = 50
            if (Math.abs(delta) > threshold) {
              if (delta > 0) {
                // swipe left -> next
                setCurrentImageIndex((idx) => Math.min(displayImages.length - 1, idx + 1))
              } else {
                // swipe right -> prev
                setCurrentImageIndex((idx) => Math.max(0, idx - 1))
              }
            }
          } finally {
            touchStartX.current = null
            touchCurrentX.current = null
          }
        }}
      >
        <div className="w-full h-[86vw] overflow-hidden relative">
          <Image
            src={displayImages[currentImageIndex] || '/placeholder-product.png'}
            alt={product.name}
            fill
            unoptimized
            className="object-cover"
            priority
            onLoad={() => setGalleryReady(true)}
          />
        </div>
        {/* Prev / Next Controls */}
        {displayImages.length > 1 && (
          <>
            <button
              onClick={() => setCurrentImageIndex((i) => Math.max(0, i - 1))}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur rounded-full p-2 shadow-md"
            >
              <ChevronLeft className="w-5 h-5 text-charcoal-800" />
            </button>
            <button
              onClick={() => setCurrentImageIndex((i) => Math.min(displayImages.length - 1, i + 1))}
              aria-label="Next image"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur rounded-full p-2 shadow-md"
            >
              <ChevronRight className="w-5 h-5 text-charcoal-800" />
            </button>
          </>
        )}
        
        

        {/* Rating Badge - Bottom Right */}
        {product.averageRating > 0 && (
          <div className="absolute bottom-4 right-4 bg-white rounded-lg px-3 py-2 shadow-md flex items-center space-x-1.5">
            <span className="text-base font-bold text-gray-900">
              {parseFloat(product.averageRating).toFixed(1)}
            </span>
            <Star className="w-4 h-4 text-yellow-400 fill-current" />
            <span className="text-sm text-gray-600">({product.ratingCount})</span>
          </div>
        )}

        {/* Dots Indicator */}
        {displayImages.length > 1 && (
          <div className="absolute bottom-16 left-0 right-0 flex justify-center space-x-1.5">
            {displayImages.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentImageIndex(index)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  index === currentImageIndex 
                    ? 'bg-gray-800' 
                    : 'bg-gray-400'
                }`}
              />
            ))}
          </div>
        )}
        {/* Thumbnail slider below images */}
        {galleryReady && displayImages.length > 1 && (
          <div className="mt-3 px-4">
            <div className="flex items-center">
              <div ref={thumbsRefMobile} className="flex gap-2 overflow-x-auto snap-x snap-mandatory py-2 scrollbar-hide">
                {displayImages.map((img, i) => (
                  <button
                    key={`${img}-${i}`}
                    onClick={() => setCurrentImageIndex(i)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden snap-center transition-all ${
                      i === currentImageIndex ? 'ring-2 ring-primary-600' : 'ring-0'
                    }`}
                  >
                    <img src={img} alt={`${product.name} thumb ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Product Title & Price */}
      <div className="bg-white px-4 py-3 border-b border-cream-200">
        <div className="flex items-start justify-between">
          <div className="flex-1 pr-3">
            <h1 className="text-lg font-bold text-charcoal-900 mb-1">
              {product.name}
            </h1>
            <p className="text-xs text-charcoal-600">
              {product.seller?.businessName || 'Brand'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleWishlist} 
              className="p-2 active:bg-primary-50 rounded-full transition-colors"
              aria-label="Add to wishlist"
            >
              <Heart 
                className={`w-5 h-5 ${isWishlisted ? 'fill-secondary-500 text-secondary-500' : 'text-charcoal-700'}`}
                strokeWidth={2}
              />
            </button>
            <button onClick={handleShare} className="p-2 active:bg-primary-50 rounded-full transition-colors">
              <Share2 className="w-5 h-5 text-charcoal-700" />
            </button>
          </div>
        </div>
        
        <div className="mt-3 flex items-center gap-3">
          {product.mrp && product.mrp > displayPrice ? (
            <>
              <span className="text-sm text-charcoal-600 line-through">₹{product.mrp?.toLocaleString()}</span>
              <span className="text-2xl font-bold text-charcoal-900">₹{displayPrice?.toLocaleString()}</span>
              <span className="bg-mint-100 text-mint-800 text-xs font-bold px-2.5 py-1 rounded-md">
                {Math.round(((product.mrp - displayPrice) / product.mrp) * 100)}% off
              </span>
            </>
          ) : (
            <span className="text-2xl font-bold text-charcoal-900">₹{displayPrice?.toLocaleString()}</span>
          )}
        </div>
      </div>

      {/* Size Selection */}
      {sizeOptions.length > 0 && (
        <div className="bg-cream-50 px-4 py-4 mb-2 border-b border-primary-100">
          <h3 className="text-sm font-bold text-charcoal-900 mb-3">
            Size: <span className="font-normal text-primary-700">{selectedSize}</span>
          </h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {sizeOptions.map((size) => {
              const optionPrice = sizePriceOptions.find(option => option?.label === size)?.price
              return (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all shadow-sm ${
                    selectedSize === size
                      ? 'bg-primary-600 text-white border-2 border-primary-700'
                      : 'bg-white border-2 border-primary-200 text-charcoal-700 hover:border-primary-400'
                  }`}
                >
                  <span>{size}</span>
                  {optionPrice !== undefined && optionPrice !== null && (
                    <span className={`block text-xs mt-0.5 ${
                      selectedSize === size ? 'text-white/80' : 'text-charcoal-500'
                    }`}>₹{Number(optionPrice).toLocaleString()}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Color Selection */}
      {colorOptions.length > 0 && (
        <div className="bg-cream-50 px-4 py-4 mb-2 border-b border-primary-100">
          <h3 className="text-sm font-bold text-charcoal-900 mb-3">
            Color: <span className="font-normal text-primary-700">{selectedColor}</span>
          </h3>
          <div className="flex flex-wrap gap-3">
            {colorOptions.map((color) => (
              <button
                key={color.name}
                onClick={() => setSelectedColor(color.name)}
                className="flex flex-col items-center gap-1.5 group"
              >
                {color.image ? (
                  <div className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all shadow-sm ${
                    selectedColor === color.name
                      ? 'border-primary-600 ring-2 ring-primary-300 scale-105'
                      : 'border-gray-200 group-active:border-primary-400'
                  }`}>
                    <img src={color.image} alt={color.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className={`w-16 h-16 rounded-xl border-2 flex items-center justify-center transition-all shadow-sm ${
                    selectedColor === color.name
                      ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-300'
                      : 'border-gray-200 bg-white group-active:border-primary-400'
                  }`}>
                    <span className={`text-xs font-semibold ${
                      selectedColor === color.name ? 'text-primary-700' : 'text-charcoal-600'
                    }`}>{color.name.slice(0, 3)}</span>
                  </div>
                )}
                <span className={`text-xs font-medium max-w-[4rem] truncate ${
                  selectedColor === color.name ? 'text-primary-700' : 'text-charcoal-600'
                }`}>{color.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Price & Delivery Info */}
      <div className="bg-warm-50 px-4 py-4 mb-2 space-y-2 border-b border-secondary-100">
        <div className="text-sm text-charcoal-600">
          Delivery by <span className="font-semibold text-charcoal-900">{deliveryDateStr}</span> - 422001
        </div>
        <button
          onClick={() => {
            if (!sellerUsername) return
            const url = getSellerUrl(sellerUsername)
            if (typeof window !== 'undefined') {
              window.open(url, '_blank', 'noopener')
            }
          }}
          disabled={!sellerUsername}
          className="text-sm text-left hover:opacity-80 transition-opacity disabled:cursor-not-allowed"
        >
          Seller: <span className="font-semibold text-primary-700 hover:text-primary-800">{product.seller?.businessName?.toUpperCase() || 'SELLER'}</span>
        </button>
      </div>

      {/* Customization Info */}
      {product.customisable && customizationQuestions.length > 0 && (
        <div className="bg-gradient-to-br from-cream-50 to-primary-50 px-5 py-5 mb-2 border border-primary-200 rounded-2xl shadow-soft">
          <div className="flex items-start space-x-3 mb-4">
            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-primary-700 mb-1">Customization Available</h3>
              <p className="text-xs text-charcoal-600 leading-relaxed">
                Please answer the following questions to personalize your product:
              </p>
            </div>
          </div>
          
          <div className="space-y-4">
            {customizationQuestions.map((item, index) => {
              const questionType = item.answerType || item.type || 'text'
              const handleInputChange = (value) => {
                console.log(`Question ${index} answered:`, value)
                setCustomizationAnswers(prev => {
                  const updated = {
                    ...prev,
                    [index]: value
                  }
                  console.log('Updated answers:', updated)
                  return updated
                })
              }
              
              return (
                <div key={index} className="space-y-2">
                  <label className="block text-sm font-semibold text-charcoal-800">
                    {item.question}
                    {item.required !== false && <span className="text-primary-600 ml-1">*</span>}
                  </label>
                  {questionType === 'photo' ? (
                    <div className="space-y-3">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoAnswerUpload(index, e.target.files?.[0])}
                        className="hidden"
                        id={`custom-photo-${index}`}
                      />
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => document.getElementById(`custom-photo-${index}`)?.click()}
                          disabled={customUploadStatus[index]}
                          className="inline-flex items-center gap-2 px-3 py-2 border border-primary-200 rounded-xl text-sm text-charcoal-700 hover:bg-primary-50 disabled:opacity-50"
                        >
                          <ImageIcon className="w-4 h-4" />
                          {customUploadStatus[index] ? 'Uploading...' : (customizationAnswers[index] ? 'Change Photo' : 'Upload Photo')}
                        </button>
                        {customizationAnswers[index] && (
                          <a
                            href={customizationAnswers[index]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary-700 hover:text-primary-800 font-medium"
                          >
                            View Photo
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (!item.type || item.type === 'text') ? (
                    <input
                      type="text"
                      value={customizationAnswers[index] || ''}
                      onChange={(e) => handleInputChange(e.target.value)}
                      onFocus={() => console.log('Input focused:', index)}
                      placeholder="Type your answer here..."
                      className="w-full px-4 py-3 text-sm border border-primary-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 bg-white text-charcoal-900 placeholder-charcoal-400 shadow-sm transition-all"
                    />
                  ) : item.type === 'select' && item.options ? (
                    <select
                      value={customizationAnswers[index] || ''}
                      onChange={(e) => handleInputChange(e.target.value)}
                      className="w-full px-4 py-3 text-sm border border-primary-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 bg-white text-charcoal-900 shadow-sm transition-all"
                    >
                      <option value="">-- Select an option --</option>
                      {item.options.map((opt, optIndex) => (
                        <option key={optIndex} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : item.type === 'textarea' ? (
                    <textarea
                      value={customizationAnswers[index] || ''}
                      onChange={(e) => handleInputChange(e.target.value)}
                      onFocus={() => console.log('Textarea focused:', index)}
                      placeholder="Type your answer here..."
                      rows="4"
                      className="w-full px-4 py-3 text-sm border border-primary-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 resize-none bg-white text-charcoal-900 placeholder-charcoal-400 shadow-sm transition-all"
                    />
                  ) : null}
                </div>
              )
            })}
          </div>
          
          <div className="mt-4 pt-4 border-t border-primary-200">
            <p className="text-xs text-charcoal-700 flex items-start">
              <span className="mr-2">💡</span>
              <span>Your customization details will be sent to the seller after placing the order.</span>
            </p>
          </div>
        </div>
      )}

      {/* Delivery & Services */}
      <div className="bg-white px-4 py-4 mb-2 border border-primary-100 rounded-xl shadow-sm">
        <h3 className="text-base font-bold text-charcoal-900 mb-4">Delivery & Services</h3>
        
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <Truck className="w-5 h-5 text-primary-700 mt-0.5" strokeWidth={1.5} />
            <div className="flex-1">
              <div className="font-semibold text-sm text-charcoal-900">Get it by {deliveryDateStr}</div>
            </div>
          </div>

          {isTwoWayDelivery && (
            <div className="flex items-start space-x-3">
              <Package className="w-5 h-5 text-amber-600 mt-0.5" strokeWidth={1.5} />
              <div className="flex-1">
                <div className="font-semibold text-sm text-charcoal-900">Two-way delivery</div>
                <div className="text-xs text-charcoal-600 mt-0.5">
                  We pick up from you first, then deliver after preservation.
                </div>
              </div>
            </div>
          )}
          
          {Boolean(product?.codAvailable) && product?.seller?.allowCod !== false && (
            <div className="flex items-start space-x-3">
              <Package className="w-5 h-5 text-secondary-700 mt-0.5" strokeWidth={1.5} />
              <div className="flex-1">
                <div className="font-semibold text-sm text-charcoal-900">Pay on Delivery is available</div>
                <div className="text-xs text-charcoal-600 mt-0.5">No extra COD fee</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Return & Exchange Policy */}
      <div className="bg-gradient-to-br from-primary-50 to-cream-50 px-4 py-4 mb-2 border border-primary-200 rounded-xl shadow-sm">
        <div className="flex items-start space-x-3 mb-3">
          <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
            <RotateCcw className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-primary-700 mb-1">Return & Exchange Policy</h3>
          </div>
        </div>
        
        {product.returnAvailable || product.exchangeAvailable ? (
          <div className="space-y-3">
            <div className="bg-white rounded-lg p-3 border border-primary-200">
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircle className="w-4 h-4 text-primary-600" strokeWidth={2} />
                <span className="text-sm font-semibold text-charcoal-900">
                  {product.returnAvailable && product.exchangeAvailable
                    ? 'Return & Exchange Available'
                    : product.exchangeAvailable
                    ? 'Only Exchange Available'
                    : 'Only Return Available'}
                </span>
              </div>
              <p className="text-sm text-charcoal-700">
                {product.returnAvailable && product.exchangeAvailable
                  ? `You can return or exchange this product within ${product.returnDays || 7} days of delivery.`
                  : product.exchangeAvailable
                  ? `You can exchange this product within ${product.returnDays || 7} days of delivery. Returns are not accepted.`
                  : `You can return this product within ${product.returnDays || 7} days of delivery.`}
              </p>
            </div>
            
            <div className="text-xs text-primary-700 space-y-1">
              <p>• Product must be unused and in original packaging</p>
              <p>• Tags and labels must be intact</p>
              <p>• Proof of purchase required</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex items-center space-x-2 mb-2">
              <AlertCircle className="w-4 h-4 text-gray-500" strokeWidth={2} />
              <span className="text-sm font-semibold text-charcoal-900">No Return or Exchange</span>
            </div>
            <p className="text-sm text-charcoal-600">
              This product cannot be returned or exchanged. Please review carefully before purchasing.
            </p>
          </div>
        )}
      </div>

      {/* Tabs Section */}
      <div className="bg-white mb-2">
        <div className="flex border-b border-cream-200 overflow-x-auto scrollbar-hide">
          {[
            { key: 'details', label: 'Product Details' },
            { key: 'seller', label: 'Seller Info' },
            { key: 'reviews', label: 'Reviews', badge: product?.ratingCount || 0 }
          ].map(({ key, label, badge }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 px-4 py-3 text-sm font-semibold transition-all whitespace-nowrap flex items-center justify-center space-x-1.5 ${
                activeTab === key
                  ? 'border-b-2 border-primary-600 text-primary-700 bg-cream-50'
                  : 'text-charcoal-600'
              }`}
            >
              <span>{label}</span>
              {badge !== undefined && (
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                  activeTab === key
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="px-4 py-4">
          {activeTab === 'details' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-charcoal-900">Description</h3>
              <p className="text-sm text-charcoal-700 leading-relaxed">
                {product.description}
              </p>

              {sizeCharts.length > 0 ? (
                <div className="pt-4 border-t border-cream-200">
                  <h4 className="text-sm font-bold text-charcoal-900 mb-3">Reference Charts</h4>
                  <div className="space-y-4">
                    {sizeCharts.map((chart, index) => (
                      <div key={`chart-${index}`} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                        <p className="text-xs font-medium text-charcoal-700 mb-2">{chart.label}</p>
                        {chart.urls && Array.isArray(chart.urls) && chart.urls.length > 0 ? (
                          <div className="grid grid-cols-2 gap-2">
                            {chart.urls.map((imageUrl, imgIndex) => (
                              <div key={`${index}-${imgIndex}`} className="relative w-full aspect-[4/5] bg-white rounded-lg overflow-hidden">
                                <Image
                                  src={imageUrl}
                                  alt={`${chart.label} - Image ${imgIndex + 1}`}
                                  fill
                                  unoptimized
                                  className="object-contain"
                                />
                              </div>
                            ))}
                          </div>
                        ) : chart.url ? (
                          <div className="relative w-full aspect-[4/5] bg-white rounded-lg overflow-hidden">
                            <Image
                              src={chart.url}
                              alt={chart.label}
                              fill
                              unoptimized
                              className="object-contain"
                            />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              
              {/* Product Specifications */}
              <div className="pt-4 border-t border-cream-200">
                <h4 className="text-sm font-bold text-charcoal-900 mb-3">Product Specifications</h4>
                <div className="grid grid-cols-2 gap-3">
                  {formatWeightDisplay(product.weight) && (
                    <div className="bg-gradient-to-br from-cream-50 to-primary-50 border border-primary-200 rounded-lg p-3">
                      <p className="text-xs text-charcoal-600 mb-1">Weight</p>
                      <p className="text-sm font-semibold text-charcoal-900">{formatWeightDisplay(product.weight)}</p>
                    </div>
                  )}
                  {product.category && (
                    <div className="bg-gradient-to-br from-primary-50 to-cream-50 border border-primary-200 rounded-lg p-3">
                      <p className="text-xs text-charcoal-600 mb-1">Category</p>
                      <p className="text-sm font-semibold text-charcoal-900 capitalize">{product.category}</p>
                    </div>
                  )}
                  {product.section && (
                    <div className="bg-gradient-to-br from-secondary-50 to-cream-50 border border-secondary-200 rounded-lg p-3">
                      <p className="text-xs text-charcoal-600 mb-1">Section</p>
                      <p className="text-sm font-semibold text-charcoal-900 capitalize">{product.section}</p>
                    </div>
                  )}
                </div>
                
                {/* Quality Badges */}
                <div className="grid grid-cols-1 gap-3 mt-3">
                  {product.isGenuine && (
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-semibold text-charcoal-900">100% Genuine Product</span>
                      </div>
                    </div>
                  )}
                  {product.isQualityChecked && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <Shield className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-semibold text-charcoal-900">Quality Checked</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Material & Care */}
              {(product.material || product.careInstructions) && (
                <div className="space-y-3">
                  {product.material && (
                    <div className="bg-gradient-to-br from-cream-50 to-primary-50 border border-primary-200 rounded-lg p-4">
                      <div className="flex items-start space-x-2 mb-2">
                        <div className="w-7 h-7 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <Package className="w-4 h-4 text-white" strokeWidth={2} />
                        </div>
                        <h4 className="text-sm font-bold text-charcoal-900 pt-1">Material Composition</h4>
                      </div>
                      <p className="text-sm text-charcoal-700 ml-9">{product.material}</p>
                    </div>
                  )}
                  {product.careInstructions && (
                    <div className="bg-gradient-to-br from-primary-50 to-cream-50 border border-primary-200 rounded-lg p-4">
                      <div className="flex items-start space-x-2 mb-2">
                        <div className="w-7 h-7 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <Shield className="w-4 h-4 text-white" strokeWidth={2} />
                        </div>
                        <h4 className="text-sm font-bold text-charcoal-900 pt-1">Care Instructions</h4>
                      </div>
                      <div className="text-sm text-charcoal-700 ml-9 whitespace-pre-line">{product.careInstructions}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Features */}
              {product.features && product.features.length > 0 && (
                <div className="pt-4 border-t border-cream-200">
                  <h4 className="text-sm font-semibold text-charcoal-900 mb-2">Key Features</h4>
                  <ul className="space-y-1.5">
                    {product.features.map((feature, index) => (
                      <li key={index} className="text-sm text-charcoal-700 flex items-start">
                        <span className="text-primary-600 mr-2">•</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Legal Disclaimer */}
              {product.legalDisclaimer && (
                <div className="pt-4 border-t border-cream-200 bg-warm-50 -mx-4 px-4 py-3 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <Shield className="w-4 h-4 text-charcoal-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-xs font-semibold text-charcoal-900 mb-1">Legal Disclaimer</h4>
                      <p className="text-xs text-charcoal-600 leading-relaxed">{product.legalDisclaimer}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'seller' && (
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-primary-100 to-primary-200 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-bold text-primary-700">
                    {product.seller?.businessName ? product.seller.businessName.charAt(0) : '?'}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-charcoal-900">{product.seller?.businessName || 'Seller'}</h3>
                  {product.seller?.city && (
                    <p className="text-xs text-charcoal-600 flex items-center mt-1">
                      <MapPin className="w-3 h-3 mr-1" />
                      {product.seller.city}
                    </p>
                  )}
                </div>
              </div>
              
              {product.seller?.businessDescription && (
                <p className="text-sm text-charcoal-700 leading-relaxed">
                  {product.seller.businessDescription}
                </p>
              )}
              
              <button
                onClick={goToSellerProfile}
                disabled={!sellerUsername}
                className={`w-full py-2.5 rounded-lg font-semibold text-sm active:scale-95 transition-all ${
                  sellerUsername
                    ? 'bg-primary-600 text-white shadow-md hover:bg-primary-700 hover:shadow-lg cursor-pointer'
                    : 'bg-primary-500 text-white/70 cursor-not-allowed opacity-60'
                }`}
              >
                Visit Seller Profile
              </button>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="-mx-4 -my-4">
              <Reviews 
                sellerId={product?.seller_id || product?.seller?.id} 
                showWriteReview={true}
              />
            </div>
          )}
        </div>
      </div>

      {/* Similar Products */}
      {similarProducts.length > 0 && (
        <div className="bg-white px-4 py-4 mb-2">
          <h3 className="text-base font-bold text-gray-900 mb-3">You May Also Like</h3>
          <div className="overflow-x-auto -mx-4 px-4 scrollbar-hide">
            <div className="flex space-x-3 pb-1">
              {similarProducts.slice(0, 6).map((item) => (
                <button
                  key={item.id}
                  onClick={() => router.push(`/product/${item.id}`)}
                  className="flex-shrink-0 w-36 group"
                >
                  <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-2 relative">
                    <Image
                      src={item.images?.[0] || '/placeholder-product.png'}
                      alt={item.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <p className="text-xs text-gray-700 font-medium line-clamp-2 mb-1">
                    {item.name}
                  </p>
                  <p className="text-sm font-bold text-gray-900">
                    ₹{item.price?.toLocaleString()}
                  </p>
                  {item.mrp && item.mrp > item.price && (
                    <p className="text-xs text-gray-400 line-through">
                      ₹{item.mrp?.toLocaleString()}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Spacer for fixed buttons */}
      <div className="h-20"></div>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-cream-50 border-t border-primary-200 px-4 py-3 shadow-lg md:hidden z-40">
        <div className="flex space-x-3">
          <button
            onClick={handleAddToCart}
            className="flex-1 bg-white border-2 border-secondary-600 text-secondary-700 font-bold py-3.5 rounded-xl hover:bg-secondary-50 transition-all active:scale-95 shadow-sm"
          >
            ADD TO BAG
          </button>
          <button
            onClick={handleBuyNow}
            className="flex-1 flex items-center justify-center space-x-2 bg-primary-600 text-white font-bold py-3.5 rounded-xl hover:bg-primary-700 transition-all active:scale-95 shadow-sm"
          >
            <Gift className="w-5 h-5" />
            <span>BUY NOW</span>
          </button>
        </div>
      </div>

      <CartSidebar />

      {/* Add custom scrollbar styles */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}
