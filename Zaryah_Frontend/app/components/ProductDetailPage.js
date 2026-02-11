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
  CheckCircle,
  RotateCcw,
  AlertCircle,
  ChevronLeft
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
  const [selectedSize, setSelectedSize] = useState(null)
  const [activeTab, setActiveTab] = useState('description')
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [customizationSelections, setCustomizationSelections] = useState({});
  const [fetchedProduct, setFetchedProduct] = useState(null);

  useEffect(() => {
    if (product?.sizeOptions && product.sizeOptions.length > 0) {
      setSelectedSize(product.sizeOptions[0])
    }
  }, [product])

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
    if (product && product.customisable && product.customQuestions) {
      const initialSelections = {};
      product.customQuestions.forEach((q, index) => {
        initialSelections[index] = {
          question: q.question,
          answer: ''
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
        const answer = customizationSelections[index]?.answer;
        return !answer || answer.trim() === '';
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
      };
    });
    addToCart(product, { quantity, giftPackaging, customizations });
    toast.success('Product added to cart!');
  }

  const handleBuyNow = async () => {
    if (!checkAuthAndRedirect()) return;
    
    // Validate customization questions if product is customizable
    if (product.customisable && product.customQuestions && product.customQuestions.length > 0) {
      const requiredQuestions = product.customQuestions.filter(q => q.required !== false);
      const unanswered = requiredQuestions.some((q, index) => {
        const answer = customizationSelections[index]?.answer;
        return !answer || answer.trim() === '';
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
      };
    });

    addToCart(product, { quantity, giftPackaging: false, customizations });
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
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-sm hover:shadow-md transition-shadow mb-6"
          aria-label="Go back"
        >
          <ChevronLeft className="w-6 h-6 text-charcoal-800" />
        </button>

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
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <p className="text-lg font-bold text-primary-700 mb-1">
                        {product.seller?.businessName || 'Brand'}
                      </p>
                      <h1 className="text-3xl font-bold text-charcoal-900 mb-2">{product.name}</h1>
                      <div className="flex items-center space-x-4 mb-3 flex-wrap gap-2">
                        <div className="flex items-center space-x-1">
                          <Star className="w-5 h-5 text-yellow-400 fill-current" />
                          <span className="font-semibold text-charcoal-900">{product.averageRating || '4.8'}</span>
                          <span className="text-charcoal-600\">({product.ratingCount || 127} reviews)</span>
                        </div>
                        {product.instantDelivery && (
                          <InstantDeliveryBadge product={product} />
                        )}
                        {product.customisable && (
                          <div className="bg-secondary-600 text-white px-3 py-1 rounded-full shadow-sm flex items-center space-x-1.5\">
                            <Sparkles className="w-4 h-4\" />
                            <span className="text-xs font-semibold">Customizable</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-3">
                        <p className="text-3xl font-bold text-primary-600">
                          ₹{product.price?.toLocaleString()}
                        </p>
                        {product.mrp && product.mrp > product.price && (
                          <>
                            <p className="text-xl text-gray-500 line-through">
                              ₹{product.mrp?.toLocaleString()}
                            </p>
                            <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                              {Math.round(((product.mrp - product.price) / product.mrp) * 100)}% OFF
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
                {product.sizeOptions && product.sizeOptions.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-charcoal-900 mb-3">SELECT SIZE</h3>
                    <div className="flex flex-wrap gap-2">
                      {product.sizeOptions.map((size) => (
                        <button
                          key={size}
                          onClick={() => setSelectedSize(size)}
                          className={`px-6 py-3 border-2 rounded-lg text-sm font-medium transition-colors ${
                            selectedSize === size
                              ? 'border-primary-600 bg-primary-50 text-primary-700'
                              : 'border-gray-300 text-charcoal-700 hover:border-gray-400'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Customization Options */}
                {product.customisable && product.customQuestions && product.customQuestions.length > 0 && (
                  <div className="bg-gradient-to-br from-blush-50 via-pink-50 to-blush-100 border border-blush-200 rounded-xl p-6 space-y-5 mb-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 bg-blush-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-5 h-5 text-white" strokeWidth={2.5} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-blush-700 mb-1">Customization Available</h3>
                        <p className="text-sm text-blush-600 leading-relaxed">
                          Please answer the following questions to personalize your product:
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      {product.customQuestions.map((question, index) => (
                        <div key={index} className="space-y-2">
                          <label className="block text-sm font-semibold text-charcoal-800">
                              {question.question}
                            {question.required !== false && <span className="text-blush-600 ml-1">*</span>}
                          </label>
                          {question.type === 'select' && question.options && question.options.length > 0 ? (
                            <select
                              value={customizationSelections[index]?.answer || ''}
                              onChange={(e) => handleCustomizationChange(index, e.target.value)}
                              className="w-full px-4 py-3 text-sm border border-cream-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blush-400 focus:border-blush-400 bg-white text-charcoal-900 shadow-sm transition-all"
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
                              className="w-full px-4 py-3 text-sm border border-cream-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blush-400 focus:border-blush-400 resize-none bg-white text-charcoal-900 placeholder-charcoal-400 shadow-sm transition-all"
                            />
                          ) : (
                            <input
                              type="text"
                              value={customizationSelections[index]?.answer || ''}
                              onChange={(e) => handleCustomizationChange(index, e.target.value)}
                              placeholder="Type your answer here..."
                              className="w-full px-4 py-3 text-sm border border-cream-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blush-400 focus:border-blush-400 bg-white text-charcoal-900 placeholder-charcoal-400 shadow-sm transition-all"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    
                    <div className="pt-4 border-t border-blush-200">
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
                    
                    {/* COD Info */}
                    {product.codAvailable && (
                      <div className="bg-gradient-to-br from-secondary-50 to-white border border-secondary-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <Package className="w-5 h-5 text-secondary-600" />
                          <h3 className="text-sm font-bold text-charcoal-900">Cash on Delivery</h3>
                        </div>
                        <p className="text-sm text-charcoal-700">Pay on Delivery available (₹10 extra)</p>
                      </div>
                    )}
                    
                    {/* Return/Exchange Info */}
                    {(product.returnAvailable || product.exchangeAvailable) && (
                      <div className="bg-gradient-to-br from-mint-50 to-white border border-mint-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <RotateCcw className="w-5 h-5 text-mint-600" />
                          <h3 className="text-sm font-bold text-charcoal-900">
                            {product.returnAvailable && product.exchangeAvailable ? 'Return & Exchange' : product.exchangeAvailable ? 'Exchange Available' : 'Return Available'}
                          </h3>
                        </div>
                        <p className="text-sm text-charcoal-700">Within {product.returnDays || 7} days of delivery</p>
                      </div>
                    )}
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
                  {product.codAvailable && (
                    <div className="flex items-center space-x-3">
                      <Package className="w-5 h-5 text-secondary-700" />
                      <div>
                        <p className="font-medium text-charcoal-900">Pay on Delivery</p>
                        <p className="text-sm text-charcoal-600">₹10 additional fee</p>
                      </div>
                    </div>
                  )}
                  {(product.returnAvailable || product.exchangeAvailable) && (
                    <div className="flex items-center space-x-3">
                      <RotateCcw className="w-5 h-5 text-mint-600" />
                      <div>
                        <p className="font-medium text-charcoal-900">
                          {product.returnAvailable && product.exchangeAvailable
                            ? 'Return & Exchange'
                            : product.exchangeAvailable
                            ? 'Exchange Available'
                            : 'Return Available'}
                        </p>
                        <p className="text-sm text-charcoal-600">Within {product.returnDays || 7} days</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-t border-gray-200">
              <div className="flex border-b border-gray-200 overflow-x-auto">
                {[
                  { key: 'description', label: 'Description' },
                  { key: 'material', label: 'Material & Care' },
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
                      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-6">
                        <div className="flex items-start space-x-3 mb-3">
                          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <Shield className="w-5 h-5 text-white" strokeWidth={2} />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-lg text-charcoal-900 mb-3">Care Instructions</h4>
                            <div className="text-charcoal-700 leading-relaxed whitespace-pre-line">{product.careInstructions}</div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {(product.returnAvailable || product.exchangeAvailable) && (
                      <div className="bg-gradient-to-br from-mint-50 to-green-50 border border-mint-200 rounded-xl p-6">
                        <div className="flex items-start space-x-3 mb-4">
                          <div className="w-10 h-10 bg-mint-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <RotateCcw className="w-5 h-5 text-white" strokeWidth={2} />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-lg text-mint-800 mb-3">Return & Exchange Policy</h4>
                          </div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 border border-mint-200 mb-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <CheckCircle className="w-5 h-5 text-mint-600" strokeWidth={2} />
                            <span className="text-base font-semibold text-charcoal-900">
                              {product.returnAvailable && product.exchangeAvailable
                                ? 'Return & Exchange Available'
                                : product.exchangeAvailable
                                ? 'Only Exchange Available'
                                : 'Only Return Available'}
                            </span>
                          </div>
                          <p className="text-charcoal-700">
                            {product.returnAvailable && product.exchangeAvailable
                              ? `You can return or exchange this product within ${product.returnDays || 7} days of delivery.`
                              : product.exchangeAvailable
                              ? `You can exchange this product within ${product.returnDays || 7} days of delivery. Returns are not accepted.`
                              : `You can return this product within ${product.returnDays || 7} days of delivery.`}
                          </p>
                        </div>
                        
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
                      </div>
                    )}
                    
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

