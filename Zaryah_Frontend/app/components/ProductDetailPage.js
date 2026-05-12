'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { 
  Heart, 
  Share2, 
  Star, 
  Truck, 
  Shield, 
  MessageCircle,
  Plus,
  Minus,
  ShoppingBag,
  Gift,
  Package,
  Scale,
  Sparkles,
  MapPin,
  Clock,
  CheckCircle,
  RotateCcw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon
} from 'lucide-react'
import { useCart } from '../contexts/CartContext'
// Instant delivery option removed — badge component no longer used here
import { useAuth } from '../contexts/AuthContext'
import { apiService } from '../services/api'
import { useRouter, useSearchParams } from 'next/navigation'
import { Reviews } from './Reviews'
import { ReviewModal } from './ReviewModal'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { formatWeightDisplay } from '@/lib/weight'

export const ProductDetailPage = ({ productId }) => {
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { addToCart } = useCart()
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [quantity, setQuantity] = useState(1)
  const [isLiked, setIsLiked] = useState(false)
  const [selectedSize, setSelectedSize] = useState(null)
  const [selectedColor, setSelectedColor] = useState(null)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [activeTab, setActiveTab] = useState('description')
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [customizationSelections, setCustomizationSelections] = useState({});
  const [customUploadStatus, setCustomUploadStatus] = useState({})
  const [fetchedProduct, setFetchedProduct] = useState(null);
  const [sellerUsername, setSellerUsername] = useState(null);
  const pointerStartX = useRef(null)
  const isPointerDown = useRef(false)
  const thumbsRef = useRef(null)

  const handlePointerDown = (e) => {
    isPointerDown.current = true
    pointerStartX.current = e.clientX ?? (e.touches?.[0]?.clientX ?? null)
  }

  const handlePointerMove = (e) => {
    // no-op; we only need start and end for simple swipe detection
  }

  const handlePointerUp = (e) => {
    if (!isPointerDown.current || pointerStartX.current == null) return
    const clientX = e.clientX ?? (e.changedTouches?.[0]?.clientX ?? null)
    if (clientX == null) {
      isPointerDown.current = false
      pointerStartX.current = null
      return
    }
    const delta = pointerStartX.current - clientX
    const threshold = 60
    if (Math.abs(delta) > threshold) {
      if (delta > 0) {
        setActiveImageIndex((i) => Math.min(displayImages.length - 1, i + 1))
      } else {
        setActiveImageIndex((i) => Math.max(0, i - 1))
      }
    }
    isPointerDown.current = false
    pointerStartX.current = null
  }

  const scrollThumbs = (dir = 1) => {
    const el = thumbsRef.current
    if (!el) return
    const amount = Math.max(120, Math.floor(el.clientWidth * 0.7))
    el.scrollBy({ left: dir * amount, behavior: 'smooth' })
  }
  
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
  const canShowCod = Boolean(product?.codAvailable) && product?.seller?.allowCod !== false
  const backTarget = String(searchParams.get('back') || '').trim()
  const safeBackTarget = backTarget.startsWith('/') ? backTarget : ''

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

  const selectedColorImage = colorOptions.find(option => option?.name === selectedColor)?.image
  const baseImages = Array.isArray(product?.images) && product.images.length > 0
    ? product.images
    : product?.image
      ? [product.image]
      : []
  const displayImages = selectedColorImage ? [selectedColorImage, ...baseImages] : baseImages

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') setActiveImageIndex((i) => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setActiveImageIndex((i) => Math.min(displayImages.length - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [displayImages.length])

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

  // Only consider charts if the new `size_charts` array (or its string) is present
  const hasCharts = sizeCharts.length > 0

  const selectedSizePrice = sizePriceOptions.find(option => option?.label === selectedSize)?.price
  const displayPrice = selectedSizePrice !== undefined && selectedSizePrice !== null
    ? Number(selectedSizePrice)
    : Number(product?.price || 0)

  const handleBack = () => {
    if (safeBackTarget) {
      router.push(safeBackTarget)
      return
    }

    if (sellerUsername) {
      router.push(`/${sellerUsername}`)
      return
    }

    router.back()
  }

  const goToSellerProfile = () => {
    if (!sellerUsername) return
    router.push(`/${sellerUsername}`)
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

    setActiveImageIndex(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id])

  useEffect(() => {
    if (!productId) {
      setError('Product ID is missing')
      setLoading(false)
      return
    }
    
    setLoading(true)
    apiService.getProduct(productId)
      .then(product => {
        if (product && product.id) {
          setProduct(product)
        } else {
          console.error('Product data invalid:', product)
          setError('Product not found')
        }
      })
      .catch((error) => {
        console.error('Error fetching product:', error)
        setError('Product not found')
      })
      .finally(() => setLoading(false))
  }, [productId])

  useEffect(() => {
    setActiveImageIndex(0)
  }, [selectedColor])

  useEffect(() => {
    if (product && product.customisable && product.customQuestions) {
      const initialSelections = {};
      product.customQuestions.forEach((q, index) => {
        initialSelections[index] = {
          question: q.question,
          answer: '',
          answerType: q.answerType || q.type || 'text'
        };
      });
      setCustomizationSelections(initialSelections);
      console.log('Customization enabled:', product.customisable);
      console.log('Custom questions:', product.customQuestions);
    }
  }, [product]);

  const checkAuthAndRedirect = () => {
    if (!user) {
      router.push('/login');
      return false;
    }
    return true;
  };

  const handleWriteReview = () => {
    if (!checkAuthAndRedirect()) return;
    setShowReviewModal(true);
  };

  if (loading) return <div>Loading...</div>
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream-50 to-primary-50">
        <div className="text-center max-w-md mx-auto px-4">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{error}</h2>
          <p className="text-gray-600">The product you're looking for doesn't exist.</p>
        </div>
      </div>
    )
  }

  const handleAddToCart = (giftPackaging = false) => {
    if (!checkAuthAndRedirect()) return;
    
    // Validate customization questions if product is customizable
    if (product.customisable && product.customQuestions && product.customQuestions.length > 0) {
      const requiredQuestions = product.customQuestions.filter(q => q.required !== false);
      const unanswered = requiredQuestions.some((q, index) => {
        const questionType = q.answerType || q.type || 'text'
        const answer = customizationSelections[index]?.answer
        if (questionType === 'photo') {
          return !answer || customUploadStatus[index]
        }
        return !answer || answer.trim() === ''
      });
      
      if (unanswered) {
        toast.error('Please answer all required customization questions');
        return;
      }
    }
    
    const customizations = Object.entries(customizationSelections).map(([key, value]) => {
      const question = product.customQuestions[key]?.question;
      return {
        question: question || "Customization",
        answer: value.answer,
        answerType: value.answerType || 'text'
      };
    });
    addToCart(product, {
      quantity,
      giftPackaging,
      customizations,
      selectedSize,
      selectedColor,
      unitPrice: displayPrice
    });
    toast.success('Product added to cart!');
  }

  const handleBuyNow = async () => {
    if (!checkAuthAndRedirect()) return;
    
    // Validate customization questions if product is customizable
    if (product.customisable && product.customQuestions && product.customQuestions.length > 0) {
      const requiredQuestions = product.customQuestions.filter(q => q.required !== false);
      const unanswered = requiredQuestions.some((q, index) => {
        const questionType = q.answerType || q.type || 'text'
        const answer = customizationSelections[index]?.answer
        if (questionType === 'photo') {
          return !answer || customUploadStatus[index]
        }
        return !answer || answer.trim() === ''
      });
      
      if (unanswered) {
        toast.error('Please answer all required customization questions');
        return;
      }
    }
    
    const customizations = Object.entries(customizationSelections).map(([key, value]) => {
      const question = product.customQuestions[key]?.question;
      return {
        question: question || "Customization",
        answer: value.answer,
        answerType: value.answerType || 'text'
      };
    });

    addToCart(product, {
      quantity,
      giftPackaging: false,
      customizations,
      selectedSize,
      selectedColor,
      unitPrice: displayPrice
    });
    router.push('/checkout');
  }

  const handleCustomizationChange = (questionIndex, answer) => {
    setCustomizationSelections(prev => ({
      ...prev,
      [questionIndex]: {
        ...prev[questionIndex],
        answer: answer
      }
    }));
  };

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

      setCustomizationSelections(prev => ({
        ...prev,
        [questionIndex]: {
          ...prev[questionIndex],
          answer: response.url
        }
      }))

      toast.success('Photo uploaded')
    } catch (error) {
      toast.error(error.message || 'Failed to upload image')
    } finally {
      setCustomUploadStatus(prev => ({ ...prev, [questionIndex]: false }))
    }
  }

  const handleOptionSelect = (questionIndex, option) => {
    setCustomizationSelections(prev => ({
      ...prev,
      [questionIndex]: {
        ...prev[questionIndex],
        answer: option
      }
    }));
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: `Check out this amazing product: ${product.name}`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 to-primary-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <button
          onClick={handleBack}
          className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-sm hover:shadow-md transition-shadow mb-6"
          aria-label="Go back"
        >
          <ChevronLeft className="w-6 h-6 text-charcoal-800" />
        </button>

        {product && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Product Images */}
              <div className="bg-white rounded-2xl shadow-soft border border-primary-100 p-8 h-fit lg:sticky lg:top-24">
                <div className="space-y-4">
                  <div
                    className="aspect-square bg-gray-100 rounded-xl overflow-hidden relative"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onTouchStart={(e) => handlePointerDown(e.touches?.[0] ?? e)}
                    onTouchEnd={(e) => handlePointerUp(e.changedTouches?.[0] ?? e)}
                  >
                    {displayImages.length > 0 ? (
                      <>
                        <Image
                          src={displayImages[activeImageIndex] || displayImages[0]}
                          alt={product.name}
                          fill
                          className="object-cover"
                          priority
                        />

                        {/* Prev / Next Controls */}
                        {displayImages.length > 1 && (
                          <>
                            <button
                              onClick={() => setActiveImageIndex((i) => Math.max(0, i - 1))}
                              aria-label="Previous image"
                              className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur rounded-full p-2 shadow-md"
                            >
                              <ChevronLeft className="w-5 h-5 text-charcoal-800" />
                            </button>
                            <button
                              onClick={() => setActiveImageIndex((i) => Math.min(displayImages.length - 1, i + 1))}
                              aria-label="Next image"
                              className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur rounded-full p-2 shadow-md"
                            >
                              <ChevronRight className="w-5 h-5 text-charcoal-800" />
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <Package className="w-16 h-16" />
                      </div>
                    )}
                  </div>
                  
                  {/* Additional Images */}
                  {displayImages.length > 1 && (
                    <div className="relative">
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => scrollThumbs(-1)}
                          aria-label="Scroll thumbnails left"
                          className="hidden lg:inline-flex items-center justify-center p-2 bg-white rounded-full shadow-sm mr-2"
                        >
                          <ChevronLeft className="w-5 h-5 text-charcoal-700" />
                        </button>

                        <div ref={thumbsRef} className="flex gap-2 overflow-x-auto snap-x snap-mandatory py-2 scrollbar-hide">
                          {displayImages.map((image, index) => (
                            <button
                              key={`${image}-${index}`}
                              type="button"
                              onClick={() => setActiveImageIndex(index)}
                              className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden relative snap-center transition-all ${
                                activeImageIndex === index ? 'ring-2 ring-primary-600' : 'ring-0'
                              }`}
                            >
                              <Image
                                src={image}
                                alt={`${product.name} ${index + 1}`}
                                fill
                                className="object-cover"
                              />
                            </button>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => scrollThumbs(1)}
                          aria-label="Scroll thumbnails right"
                          className="hidden lg:inline-flex items-center justify-center p-2 bg-white rounded-full shadow-sm ml-2"
                        >
                          <ChevronRight className="w-5 h-5 text-charcoal-700" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Product Info */}
              <div className="bg-white rounded-2xl shadow-soft border border-primary-100 p-8 space-y-6">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <button
                        type="button"
                        onClick={goToSellerProfile}
                        disabled={!sellerUsername}
                        className={`text-lg font-bold mb-1 ${sellerUsername ? 'text-primary-700 hover:text-primary-800 hover:underline cursor-pointer' : 'text-primary-700 cursor-default'}`}
                      >
                        {product.seller?.businessName || 'Brand'}
                      </button>
                      <h1 className="text-3xl font-bold text-charcoal-900 mb-2">{product.name}</h1>
                      <div className="flex items-center space-x-4 mb-3 flex-wrap gap-2">
                        <div className="flex items-center space-x-1">
                          <Star className="w-5 h-5 text-yellow-400 fill-current" />
                          <span className="font-semibold text-charcoal-900">
                            {product.averageRating ? parseFloat(product.averageRating).toFixed(1) : 'New'}
                          </span>
                          {product.ratingCount > 0 && (
                            <span className="text-charcoal-600">({product.ratingCount} {product.ratingCount === 1 ? 'review' : 'reviews'})</span>
                          )}
                        </div>
                        {/* Instant delivery option removed */}
                        {product.customisable && (
                          <div className="bg-secondary-600 text-white px-3 py-1 rounded-full shadow-sm flex items-center space-x-1.5\">
                            <Sparkles className="w-4 h-4\" />
                            <span className="text-xs font-semibold">Customizable</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-3">
                        <p className="text-3xl font-bold text-primary-600">
                          ₹{displayPrice?.toLocaleString()}
                        </p>
                        {product.mrp && product.mrp > displayPrice && (
                          <>
                            <p className="text-xl text-gray-500 line-through">
                              ₹{product.mrp?.toLocaleString()}
                            </p>
                            <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                              {Math.round(((product.mrp - displayPrice) / product.mrp) * 100)}% OFF
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setIsLiked(!isLiked)}
                        className={`p-3 rounded-full transition-colors ${
                          isLiked ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        onClick={handleShare}
                        className="p-3 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
                      >
                        <Share2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                
                {/* Trust Badges */}
                {(product.isGenuine || product.isQualityChecked) && (
                  <div className="flex items-center space-x-4 mb-4">
                  {product.isGenuine && (
                    <div className="flex items-center space-x-2 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-medium text-green-700">Genuine Product</span>
                    </div>
                  )}
                  {product.isQualityChecked && (
                    <div className="flex items-center space-x-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                      <Shield className="w-5 h-5 text-blue-600" />
                      <span className="text-sm font-medium text-blue-700">Quality Checked</span>
                    </div>
                  )}
                </div>
                )}

                {/* Size Selection */}
                {sizeOptions.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-charcoal-900 mb-3">SELECT SIZE</h3>
                    <div className="flex flex-wrap gap-2">
                      {sizeOptions.map((size) => {
                        const optionPrice = sizePriceOptions.find(option => option?.label === size)?.price
                        return (
                        <button
                          key={size}
                          onClick={() => setSelectedSize(size)}
                          className={`px-6 py-3 border-2 rounded-lg text-sm font-medium transition-colors ${
                            selectedSize === size
                              ? 'border-primary-600 bg-primary-50 text-primary-700'
                              : 'border-gray-300 text-charcoal-700 hover:border-gray-400'
                          }`}
                        >
                          <span className="block">{size}</span>
                          {optionPrice !== undefined && optionPrice !== null && (
                            <span className="block text-xs text-charcoal-500 mt-1">₹{Number(optionPrice).toLocaleString()}</span>
                          )}
                        </button>
                      )})}
                    </div>
                  </div>
                )}

                {colorOptions.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-charcoal-900 mb-3">SELECT COLOR</h3>
                    <div className="flex flex-wrap gap-3">
                      {colorOptions.map((color) => (
                        <button
                          key={color.name}
                          onClick={() => setSelectedColor(color.name)}
                          className="flex flex-col items-center gap-1.5 group"
                        >
                          {color.image ? (
                            <div className={`w-[72px] h-[72px] rounded-xl overflow-hidden border-2 transition-all ${
                              selectedColor === color.name
                                ? 'border-primary-600 ring-2 ring-primary-200 shadow-md scale-105'
                                : 'border-gray-200 hover:border-gray-400 shadow-sm'
                            }`}>
                              <img src={color.image} alt={color.name} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className={`w-[72px] h-[72px] rounded-xl border-2 flex items-center justify-center transition-all ${
                              selectedColor === color.name
                                ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-200 shadow-md'
                                : 'border-gray-200 bg-gray-50 hover:border-gray-400 shadow-sm'
                            }`}>
                              <span className={`text-sm font-semibold ${
                                selectedColor === color.name ? 'text-primary-700' : 'text-charcoal-600'
                              }`}>{color.name.slice(0, 4)}</span>
                            </div>
                          )}
                          <span className={`text-xs font-medium max-w-[4.5rem] truncate ${
                            selectedColor === color.name ? 'text-primary-700' : 'text-charcoal-600'
                          }`}>{color.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Customization Options */}
                {product.customisable && product.customQuestions && product.customQuestions.length > 0 && (
                  <div className="bg-gradient-to-br from-cream-50 to-primary-50 border border-primary-200 rounded-xl p-6 space-y-5 mb-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-5 h-5 text-white" strokeWidth={2.5} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-primary-700 mb-1">Customization Available</h3>
                        <p className="text-sm text-charcoal-600 leading-relaxed">
                          Please answer the following questions to personalize your product:
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      {product.customQuestions.map((question, index) => {
                        const questionType = question.answerType || question.type || 'text'
                        return (
                        <div key={index} className="space-y-2">
                          <label className="block text-sm font-semibold text-charcoal-800">
                              {question.question}
                            {question.required !== false && <span className="text-primary-600 ml-1">*</span>}
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
                                  {customUploadStatus[index] ? 'Uploading...' : (customizationSelections[index]?.answer ? 'Change Photo' : 'Upload Photo')}
                                </button>
                                {customizationSelections[index]?.answer && (
                                  <a
                                    href={customizationSelections[index].answer}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-primary-700 hover:text-primary-800 font-medium"
                                  >
                                    View Photo
                                  </a>
                                )}
                              </div>
                            </div>
                          ) : question.type === 'select' && question.options && question.options.length > 0 ? (
                            <select
                              value={customizationSelections[index]?.answer || ''}
                              onChange={(e) => handleCustomizationChange(index, e.target.value)}
                              className="w-full px-4 py-3 text-sm border border-primary-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 bg-white text-charcoal-900 shadow-sm transition-all"
                            >
                              <option value="">-- Select an option --</option>
                              {question.options.map((opt, optIndex) => (
                                <option key={optIndex} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : question.type === 'textarea' ? (
                            <textarea
                              value={customizationSelections[index]?.answer || ''}
                              onChange={(e) => handleCustomizationChange(index, e.target.value)}
                              placeholder="Type your answer here..."
                              rows="4"
                              className="w-full px-4 py-3 text-sm border border-primary-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 resize-none bg-white text-charcoal-900 placeholder-charcoal-400 shadow-sm transition-all"
                            />
                          ) : (
                            <input
                              type="text"
                              value={customizationSelections[index]?.answer || ''}
                              onChange={(e) => handleCustomizationChange(index, e.target.value)}
                              placeholder="Type your answer here..."
                              className="w-full px-4 py-3 text-sm border border-primary-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 bg-white text-charcoal-900 placeholder-charcoal-400 shadow-sm transition-all"
                            />
                          )}
                        </div>
                        )
                      })}
                    </div>
                    
                    <div className="pt-4 border-t border-primary-200">
                      <p className="text-xs text-blush-700 flex items-start">
                        <span className="mr-2">💡</span>
                        <span>Your customization details will be sent to the seller after placing the order.</span>
                      </p>
                    </div>
                  </div>
                )}

                {/* Product Info Cards */}
                <div className="space-y-3">
                    {/* Delivery Info */}
                    <div className="bg-gradient-to-br from-cream-50 to-white border border-primary-200 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <Truck className="w-5 h-5 text-primary-600" />
                        <h3 className="text-sm font-bold text-charcoal-900">Delivery Information</h3>
                      </div>
                      <p className="text-sm text-charcoal-700">
                        Get it by <span className="font-semibold">{new Date(Date.now() + (product.delivery_time_max || 7) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      </p>
                    </div>
                    
                    {isTwoWayDelivery && (
                      <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <Package className="w-5 h-5 text-amber-600" />
                          <h3 className="text-sm font-bold text-charcoal-900">Two-way Delivery</h3>
                        </div>
                        <p className="text-sm text-charcoal-700">
                          We arrange pickup from your address first, then the seller ships the preserved product back.
                        </p>
                      </div>
                    )}

                    {/* COD Info */}
                    {canShowCod && (
                      <div className="bg-gradient-to-br from-secondary-50 to-white border border-secondary-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <Package className="w-5 h-5 text-secondary-600" />
                          <h3 className="text-sm font-bold text-charcoal-900">Cash on Delivery</h3>
                        </div>
                        <p className="text-sm text-charcoal-700">Pay on Delivery available (₹10 extra)</p>
                      </div>
                    )}
                    
                    {/* Return/Exchange Info */}
                    <div className="bg-gradient-to-br from-primary-50 to-cream-50 border border-primary-200 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        {product.returnAvailable || product.exchangeAvailable ? (
                          <RotateCcw className="w-5 h-5 text-primary-600" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-gray-500" />
                        )}
                        <h3 className="text-sm font-bold text-charcoal-900">
                          {product.returnAvailable && product.exchangeAvailable
                            ? 'Return & Exchange'
                            : product.exchangeAvailable
                            ? 'Exchange Available'
                            : product.returnAvailable
                            ? 'Return Available'
                            : 'No Return or Exchange'}
                        </h3>
                      </div>
                      <p className="text-sm text-charcoal-700">
                        {product.returnAvailable || product.exchangeAvailable
                          ? `Within ${product.returnDays || 7} days of delivery`
                          : 'This product is not eligible for return or exchange.'}
                      </p>
                    </div>
                  </div>

                {/* Quantity */}
                <div className="flex items-center space-x-4">
                  <label className="text-sm font-medium text-charcoal-700">Quantity:</label>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-12 text-center font-medium">{quantity}</span>
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-4">
                  <button
                    onClick={() => handleAddToCart(false)}
                    className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    <ShoppingBag className="w-5 h-5" />
                    <span>Add to Cart</span>
                  </button>
                  <button
                    onClick={handleBuyNow}
                    className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-charcoal-900 text-white rounded-lg hover:bg-charcoal-800 transition-colors"
                  >
                    <Gift className="w-5 h-5" />
                    <span>Buy Now</span>
                  </button>
                </div>

                {/* Gift Packaging Option */}
                <button
                  onClick={() => handleAddToCart(true)}
                  className="w-full flex items-center justify-center space-x-2 px-6 py-3 border-2 border-primary-300 text-primary-700 rounded-lg hover:bg-primary-50 transition-colors"
                >
                  <Gift className="w-5 h-5" />
                  <span>Add to Cart with Gift Packaging (+₹10)</span>
                </button>

                {/* Features */}
                <div className="grid grid-cols-2 gap-4 pt-6 border-t border-gray-200">
                  <div className="flex items-center space-x-3">
                    <Truck className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-medium text-charcoal-900">Free Delivery</p>
                      <p className="text-sm text-charcoal-600">On orders above ₹500</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-charcoal-900">Expected Delivery</p>
                      <p className="text-sm text-charcoal-600">
                        {product.delivery_time_min && product.delivery_time_max 
                          ? `${product.delivery_time_min}-${product.delivery_time_max} ${product.delivery_time_unit || 'days'}`
                          : '2-5 days'}
                      </p>
                    </div>
                  </div>
                  {canShowCod && (
                    <div className="flex items-center space-x-3">
                      <Package className="w-5 h-5 text-secondary-700" />
                      <div>
                        <p className="font-medium text-charcoal-900">Pay on Delivery</p>
                        <p className="text-sm text-charcoal-600">No extra COD fee</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center space-x-3">
                    {product.returnAvailable || product.exchangeAvailable ? (
                      <RotateCcw className="w-5 h-5 text-mint-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-gray-500" />
                    )}
                    <div>
                      <p className="font-medium text-charcoal-900">
                        {product.returnAvailable && product.exchangeAvailable
                          ? 'Return & Exchange'
                          : product.exchangeAvailable
                          ? 'Exchange Available'
                          : product.returnAvailable
                          ? 'Return Available'
                          : 'No Return or Exchange'}
                      </p>
                      <p className="text-sm text-charcoal-600">
                        {product.returnAvailable || product.exchangeAvailable
                          ? `Within ${product.returnDays || 7} days`
                          : 'Not eligible for return or exchange'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-2xl shadow-soft border border-primary-100 overflow-hidden">
              <div className="flex border-b border-gray-200 overflow-x-auto">
                {[
                  { key: 'description', label: 'Description' },
                  { key: 'details', label: 'Product Details' },
                  { key: 'material', label: 'Material & Care' },
                  ...(hasCharts ? [{ key: 'charts', label: 'Reference Charts' }] : []),
                  { 
                    key: 'reviews', 
                    label: 'Reviews',
                    badge: product?.ratingCount || 0
                  },
                  { key: 'seller', label: 'Seller Info' }
                ].map(({ key, label, badge }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`px-6 py-4 font-medium transition-colors whitespace-nowrap flex items-center space-x-2 ${
                      activeTab === key
                        ? 'border-b-2 border-primary-600 text-primary-600'
                        : 'text-charcoal-600 hover:text-charcoal-900'
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

              <div className="p-8">
                {activeTab === 'description' && (
                  <div className="prose max-w-none">
                    <h3 className="text-xl font-semibold text-charcoal-900 mb-4">Product Description</h3>
                    <div className="text-charcoal-700 leading-relaxed space-y-4">
                      <p>{product.description}</p>
                      {product.features && product.features.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-charcoal-900 mb-2">Key Features:</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {product.features.map((feature, index) => (
                              <li key={index} className="text-charcoal-700">{feature}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {product.legalDisclaimer && (
                        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start space-x-2">
                            <Shield className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <h4 className="font-semibold text-charcoal-900 mb-1">Legal Disclaimer</h4>
                              <p className="text-sm text-charcoal-600">{product.legalDisclaimer}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'details' && (
                  <div className="space-y-6">
                    <h3 className="text-xl font-semibold text-charcoal-900 mb-6">Product Specifications</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Weight */}
                      {formatWeightDisplay(product.weight) && (
                        <div className="bg-gradient-to-br from-cream-50 to-primary-50 border border-primary-200 rounded-lg p-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                              <Scale className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="text-sm text-charcoal-600 font-medium">Weight</p>
                              <p className="text-lg font-semibold text-charcoal-900">{formatWeightDisplay(product.weight)}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Stock */}
                      {product.stock !== undefined && product.stock !== null && (
                        <div className="bg-gradient-to-br from-primary-50 to-cream-50 border border-primary-200 rounded-lg p-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                              <Package className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="text-sm text-charcoal-600 font-medium">Stock Available</p>
                              <p className="text-lg font-semibold text-charcoal-900">
                                {product.stock > 0 ? `${product.stock} units` : 'Out of Stock'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Category */}
                      {product.category && (
                        <div className="bg-gradient-to-br from-primary-50 to-cream-50 border border-primary-200 rounded-lg p-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                              <Package className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="text-sm text-charcoal-600 font-medium">Category</p>
                              <p className="text-lg font-semibold text-charcoal-900 capitalize">{product.category}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Section */}
                      {product.section && (
                        <div className="bg-gradient-to-br from-secondary-50 to-cream-50 border border-secondary-200 rounded-lg p-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-secondary-600 rounded-full flex items-center justify-center flex-shrink-0">
                              <Package className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="text-sm text-charcoal-600 font-medium">Section</p>
                              <p className="text-lg font-semibold text-charcoal-900 capitalize">{product.section}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Quality Badges */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                      {product.isGenuine && (
                        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-4">
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="w-5 h-5 text-emerald-600" />
                            <span className="font-semibold text-charcoal-900">100% Genuine Product</span>
                          </div>
                          <p className="text-sm text-charcoal-600 mt-1">Verified authenticity guaranteed</p>
                        </div>
                      )}

                      {product.isQualityChecked && (
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-center space-x-2">
                            <Shield className="w-5 h-5 text-blue-600" />
                            <span className="font-semibold text-charcoal-900">Quality Checked</span>
                          </div>
                          <p className="text-sm text-charcoal-600 mt-1">Inspected for quality assurance</p>
                        </div>
                      )}
                    </div>

                    {/* Delivery Information */}
                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-6 mt-6">
                      <h4 className="font-semibold text-charcoal-900 mb-4 flex items-center space-x-2">
                        <Truck className="w-5 h-5 text-orange-600" />
                        <span>Delivery Information</span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-charcoal-600 mb-1">Estimated Delivery Time</p>
                          <p className="font-semibold text-charcoal-900">
                            {product.delivery_time_min && product.delivery_time_max 
                              ? `${product.delivery_time_min}-${product.delivery_time_max} ${product.delivery_time_unit || 'days'}`
                              : '2-5 days'}
                          </p>
                        </div>
                        {/* Instant delivery option removed */}
                        {canShowCod && (
                          <div>
                            <p className="text-sm text-charcoal-600 mb-1">Cash on Delivery</p>
                            <p className="font-semibold text-charcoal-900">Available (₹10 extra)</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Size Options */}
                    {product.sizeOptions && product.sizeOptions.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <h4 className="font-semibold text-charcoal-900 mb-3">Available Sizes</h4>
                        <div className="flex flex-wrap gap-2">
                          {product.sizeOptions.map((size, index) => (
                            <div 
                              key={index} 
                              className="px-4 py-2 bg-gray-100 text-charcoal-900 rounded-lg font-medium"
                            >
                              {size}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'charts' && hasCharts && (
                  <div className="space-y-6">
                    <h3 className="text-xl font-semibold text-charcoal-900">Reference Charts</h3>
                    {sizeCharts.length > 0 ? (
                          <div className="space-y-6">
                            {sizeCharts.map((chart, index) => (
                              <div key={`chart-${index}`} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                                <h4 className="text-lg font-medium text-charcoal-800 mb-4">{chart.label}</h4>
                                {chart.urls && Array.isArray(chart.urls) && chart.urls.length > 0 ? (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {chart.urls.map((imageUrl, imgIndex) => (
                                      <div key={`${index}-${imgIndex}`} className="relative w-full aspect-[4/5] bg-white rounded-lg overflow-hidden">
                                        <Image
                                          src={imageUrl}
                                          alt={`${chart.label} - Image ${imgIndex + 1}`}
                                          fill
                                          className="object-contain"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                ) : chart.url ? (
                                  <div className="relative w-full max-w-2xl mx-auto aspect-[4/5] bg-white rounded-lg overflow-hidden">
                                    <Image
                                      src={chart.url}
                                      alt={chart.label}
                                      fill
                                      className="object-contain"
                                    />
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : (product?.sizeChartUrl || product?.size_chart_url) ? (
                          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                            <h4 className="text-lg font-medium text-charcoal-800 mb-4">Size Chart</h4>
                            <div className="relative w-full max-w-2xl mx-auto aspect-[4/5] bg-white rounded-lg overflow-hidden">
                              <Image
                                src={product.sizeChartUrl || product.size_chart_url}
                                alt="Size Chart"
                                fill
                                className="object-contain"
                              />
                            </div>
                          </div>
                        ) : null}
                  </div>
                )}

                {activeTab === 'material' && (
                  <div className="space-y-6">
                    <h3 className="text-xl font-semibold text-charcoal-900 mb-6">Material & Care Instructions</h3>
                    
                    {product.material && (
                      <div className="bg-gradient-to-br from-cream-50 to-primary-50 border border-primary-200 rounded-xl p-6">
                        <div className="flex items-start space-x-3 mb-3">
                          <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <Package className="w-5 h-5 text-white" strokeWidth={2} />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-lg text-charcoal-900 mb-3">Material Composition</h4>
                            <p className="text-charcoal-700 leading-relaxed">{product.material}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {product.careInstructions && (
                      <div className="bg-gradient-to-br from-primary-50 to-cream-50 border border-primary-200 rounded-xl p-6">
                        <div className="flex items-start space-x-3 mb-3">
                          <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <Shield className="w-5 h-5 text-white" strokeWidth={2} />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-lg text-charcoal-900 mb-3">Care Instructions</h4>
                            <div className="text-charcoal-700 leading-relaxed whitespace-pre-line">{product.careInstructions}</div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="bg-gradient-to-br from-mint-50 to-green-50 border border-mint-200 rounded-xl p-6">
                      <div className="flex items-start space-x-3 mb-4">
                        <div className="w-10 h-10 bg-mint-600 rounded-full flex items-center justify-center flex-shrink-0">
                          {product.returnAvailable || product.exchangeAvailable ? (
                            <RotateCcw className="w-5 h-5 text-white" strokeWidth={2} />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-white" strokeWidth={2} />
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-lg text-mint-800 mb-3">Return & Exchange Policy</h4>
                        </div>
                      </div>
                      
                      <div className="bg-white rounded-lg p-4 border border-mint-200 mb-4">
                        <div className="flex items-center space-x-2 mb-2">
                          {product.returnAvailable || product.exchangeAvailable ? (
                            <CheckCircle className="w-5 h-5 text-mint-600" strokeWidth={2} />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-gray-500" strokeWidth={2} />
                          )}
                          <span className="text-base font-semibold text-charcoal-900">
                            {product.returnAvailable && product.exchangeAvailable
                              ? 'Return & Exchange Available'
                              : product.exchangeAvailable
                              ? 'Only Exchange Available'
                              : product.returnAvailable
                              ? 'Only Return Available'
                              : 'No Return or Exchange'}
                          </span>
                        </div>
                        <p className="text-charcoal-700">
                          {product.returnAvailable && product.exchangeAvailable
                            ? `You can return or exchange this product within ${product.returnDays || 7} days of delivery.`
                            : product.exchangeAvailable
                            ? `You can exchange this product within ${product.returnDays || 7} days of delivery. Returns are not accepted.`
                            : product.returnAvailable
                            ? `You can return this product within ${product.returnDays || 7} days of delivery.`
                            : 'This product is not eligible for return or exchange.'}
                        </p>
                      </div>
                      
                      {(product.returnAvailable || product.exchangeAvailable) && (
                        <div className="text-sm text-mint-700 space-y-2">
                          <p className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>Product must be unused and in original packaging</span>
                          </p>
                          <p className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>Tags and labels must be intact</span>
                          </p>
                          <p className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>Proof of purchase required</span>
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {!product.material && !product.careInstructions && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-charcoal-600">No material or care information available for this product.</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'reviews' && (
                  <Reviews 
                    productId={productId} 
                    showWriteReview={true}
                    onWriteReview={handleWriteReview}
                  />
                )}

                {activeTab === 'seller' && (
                  <div>
                    <div className="flex items-center space-x-4 mb-6">
                      <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-2xl font-bold text-primary-600">
                          {product.seller?.businessName ? product.seller.businessName.charAt(0) : '?'}
                        </span>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={goToSellerProfile}
                          disabled={!sellerUsername}
                          className={`text-xl font-semibold ${sellerUsername ? 'hover:text-primary-700 hover:underline cursor-pointer' : 'cursor-default'}`}
                        >
                          {product.seller?.businessName || 'Loading seller info...'}
                        </button>
                        <p className="text-gray-600">{product.seller?.businessAddress || 'Address not available'}</p>
                        <div className="flex items-center space-x-1 mt-1">
                          <Star className="w-4 h-4 text-yellow-400 fill-current" />
                          <span className="text-sm text-gray-600">4.9 seller rating</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-700 leading-relaxed">
                      {product.seller?.businessDescription || 'A passionate seller dedicated to providing quality products and excellent service.'}
                    </p>
                    {sellerUsername && (
                      <button
                        type="button"
                        onClick={goToSellerProfile}
                        className="mt-5 inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
                      >
                        Visit Seller Profile
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Review Modal */}
      <ReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        product={product}
      />
    </div>
  )
}

