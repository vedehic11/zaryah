'use client'

import { useState, useEffect } from 'react'
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
  CheckCircle
} from 'lucide-react'
import { useCart } from '../contexts/CartContext'
import { InstantDeliveryBadge, DeliveryTimeEstimate } from './InstantDeliveryBadge'
import { useAuth } from '../contexts/AuthContext'
import { apiService } from '../services/api'
import { useRouter } from 'next/navigation'
import { Reviews } from './Reviews'
import { ReviewModal } from './ReviewModal'
import toast from 'react-hot-toast'

export const ProductDetailPage = ({ productId }) => {
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { addToCart } = useCart()
  const { user } = useAuth()
  const router = useRouter()
  const [quantity, setQuantity] = useState(1)
  const [isLiked, setIsLiked] = useState(false)
  const [activeTab, setActiveTab] = useState('description')
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [customizationSelections, setCustomizationSelections] = useState({});
  const [fetchedProduct, setFetchedProduct] = useState(null);

  useEffect(() => {
    if (!productId) {
      setError('Product ID is missing')
      setLoading(false)
      return
    }
    
    // Check if this is a dummy product ID
    if (productId.startsWith('dummy-') || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)) {
      setError('This is a demo product. Please use products from the database.')
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
        // Check if it's the dummy product error message - don't log as error
        if (error.message && error.message.includes('demo product')) {
          setError('This is a demo product. Please use products from the database.')
        } else {
          console.error('Error fetching product:', error)
          setError('Product not found')
        }
      })
      .finally(() => setLoading(false))
  }, [productId])

  useEffect(() => {
    if (product && product.customQuestions) {
      const initialSelections = {};
      product.customQuestions.forEach((q, index) => {
        initialSelections[index] = {
          question: q.question,
          answer: q.options?.length > 0 ? q.options[0] : ''
        };
      });
      setCustomizationSelections(initialSelections);
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
    const isDemoProduct = error.includes('demo product')
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream-50 to-primary-50">
        <div className="text-center max-w-md mx-auto px-4">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{error}</h2>
          {isDemoProduct ? (
            <div className="space-y-4">
              <p className="text-gray-600">This is a demo product for display purposes only.</p>
              <button
                onClick={() => router.push('/shop')}
                className="mt-4 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Browse Real Products
              </button>
            </div>
          ) : (
            <p className="text-gray-600">The product you're looking for doesn't exist.</p>
          )}
        </div>
      </div>
    )
  }

  const handleAddToCart = (giftPackaging = false) => {
    if (!checkAuthAndRedirect()) return;
    
    const customizations = Object.entries(customizationSelections).map(([key, value]) => {
      const question = product.customQuestions[key]?.question;
      return {
        question: question || "Customization",
        answer: value.answer,
      };
    });
    addToCart(product, quantity, giftPackaging, customizations);
    toast.success('Product added to cart!');
  }

  const handleBuyNow = async () => {
    if (!checkAuthAndRedirect()) return;
    
    const customizations = Object.entries(customizationSelections).map(([key, value]) => {
      const question = product.customQuestions[key]?.question;
      return {
        question: question || "Customization",
        answer: value.answer,
      };
    });
    
    addToCart(product, quantity, false, customizations);
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
        {product && (
          <div className="bg-white rounded-2xl shadow-soft border border-primary-100 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8">
              {/* Product Images */}
              <div className="space-y-4">
                <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden">
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <Package className="w-16 h-16" />
                    </div>
                  )}
                </div>
                
                {/* Additional Images */}
                {product.images && product.images.length > 1 && (
                  <div className="grid grid-cols-4 gap-2">
                    {product.images.slice(1, 5).map((image, index) => (
                      <div key={index} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                        <img
                          src={image}
                          alt={`${product.name} ${index + 2}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="space-y-6">
                {/* Header */}
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h1 className="text-3xl font-bold text-charcoal-900 mb-2">{product.name}</h1>
                      <div className="flex items-center space-x-4 mb-3">
                        <div className="flex items-center space-x-1">
                          <Star className="w-5 h-5 text-yellow-400 fill-current" />
                          <span className="font-semibold text-charcoal-900">4.8</span>
                          <span className="text-charcoal-600">(127 reviews)</span>
                        </div>
                        <InstantDeliveryBadge product={product} />
                      </div>
                      <p className="text-2xl font-bold text-primary-600">
                        ₹{product.price?.toLocaleString()}
                      </p>
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
                  
                  <p className="text-charcoal-700 leading-relaxed">{product.description}</p>
                </div>

                {/* Customization Options */}
                {product.customQuestions && product.customQuestions.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-charcoal-900">Customization Options</h3>
                    {product.customQuestions.map((question, index) => (
                      <div key={index} className="space-y-2">
                        <label className="block text-sm font-medium text-charcoal-700">
                          {question.question}
                        </label>
                        {question.options && question.options.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {question.options.map((option, optionIndex) => (
                              <button
                                key={optionIndex}
                                onClick={() => handleOptionSelect(index, option)}
                                className={`px-3 py-2 rounded-lg border transition-colors ${
                                  customizationSelections[index]?.answer === option
                                    ? 'border-primary-600 bg-primary-50 text-primary-700'
                                    : 'border-gray-300 text-charcoal-700 hover:border-primary-300'
                                }`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={customizationSelections[index]?.answer || ''}
                            onChange={(e) => handleCustomizationChange(index, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            placeholder="Enter your preference..."
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

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
                  <span>Add to Cart with Gift Packaging (+₹50)</span>
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
                    <Shield className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-charcoal-900">Secure Payment</p>
                      <p className="text-sm text-charcoal-600">100% secure checkout</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-medium text-charcoal-900">Quality Assured</p>
                      <p className="text-sm text-charcoal-600">Premium quality products</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MessageCircle className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="font-medium text-charcoal-900">24/7 Support</p>
                      <p className="text-sm text-charcoal-600">Always here to help</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-t border-gray-200">
              <div className="flex border-b border-gray-200">
                {[
                  { key: 'description', label: 'Description' },
                  { key: 'reviews', label: 'Reviews' },
                  { key: 'seller', label: 'Seller Info' }
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`px-6 py-4 font-medium transition-colors ${
                      activeTab === key
                        ? 'border-b-2 border-primary-600 text-primary-600'
                        : 'text-charcoal-600 hover:text-charcoal-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="p-8">
                {activeTab === 'description' && (
                  <div className="prose max-w-none">
                    <h3 className="text-xl font-semibold text-charcoal-900 mb-4">Product Description</h3>
                    <div className="text-charcoal-700 leading-relaxed space-y-4">
                      <p>{product.description}</p>
                      {product.features && (
                        <div>
                          <h4 className="font-semibold text-charcoal-900 mb-2">Key Features:</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {product.features.map((feature, index) => (
                              <li key={index} className="text-charcoal-700">{feature}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
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
                        <h3 className="text-xl font-semibold">{product.seller?.businessName || 'Loading seller info...'}</h3>
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

        )}
