'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, Heart, Share2, ShoppingBag, MapPin, CheckCircle, Shield, AlertCircle, Search, Package, Truck, RotateCcw, Sparkles, Star } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCart } from '../contexts/CartContext'
import { toast } from 'react-hot-toast'
import { Reviews } from './Reviews'

export default function MobileProductDetail({ product, similarProducts = [] }) {
  const router = useRouter()
  const { addToCart } = useCart()
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [selectedSize, setSelectedSize] = useState(null)
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [customizationAnswers, setCustomizationAnswers] = useState({})
  const [activeTab, setActiveTab] = useState('details')

  useEffect(() => {
    if (product?.sizeOptions && product.sizeOptions.length > 0) {
      setSelectedSize(product.sizeOptions[0])
    }
    // Debug customization questions
    if (product?.customisable && product?.customQuestions) {
      console.log('Customization enabled:', product.customisable)
      console.log('Custom questions:', product.customQuestions)
    }
  }, [product])

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-500">Product not found</p>
      </div>
    )
  }

  const discount = product.mrp && product.price < product.mrp
    ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
    : 0

  const handleAddToCart = async () => {
    // Validate customization questions if product is customizable
    if (product.customisable && product.customQuestions && product.customQuestions.length > 0) {
      const unanswered = product.customQuestions.some((q, index) => !customizationAnswers[index] || customizationAnswers[index].trim() === '')
      if (unanswered) {
        toast.error('Please answer all customization questions before adding to bag')
        return
      }
    }
    
    try {
      const customizations = product.customisable && product.customQuestions 
        ? product.customQuestions.map((q, index) => ({
            question: q.question,
            answer: customizationAnswers[index]
          }))
        : []
      
      await addToCart(product, { 
        quantity: 1, 
        selectedSize,
        customizations 
      })
      toast.success('Added to bag!')
    } catch (error) {
      toast.error(error.message || 'Failed to add to bag')
    }
  }

  const handleBuyNow = async () => {
    await handleAddToCart()
    router.push('/orders')
  }

  const toggleWishlist = () => {
    setIsWishlisted(!isWishlisted)
    toast.success(isWishlisted ? 'Removed from wishlist' : 'Added to wishlist')
  }

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
          <button 
            onClick={() => router.back()}
            className="p-1 -ml-1 active:bg-primary-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-7 h-7 text-charcoal-800" strokeWidth={2} />
          </button>
          
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
            onClick={toggleWishlist}
            className="p-1.5 active:bg-primary-100 rounded-full transition-colors"
          >
            <Heart 
              className={`w-6 h-6 ${isWishlisted ? 'fill-secondary-500 text-secondary-500' : 'text-charcoal-800'}`}
              strokeWidth={2}
            />
          </button>
          
          <button 
            className="p-1.5 active:bg-primary-100 rounded-full transition-colors"
          >
            <ShoppingBag className="w-6 h-6 text-charcoal-800" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Image Carousel */}
      <div className="relative bg-white">
        <div className="aspect-square overflow-hidden">
          <img
            src={product.images?.[currentImageIndex] || '/placeholder-product.png'}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
        
        {/* View Similar Button - Bottom Left */}
        <button className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg px-4 py-2 shadow-soft border border-primary-200 flex items-center space-x-2 active:scale-95 transition-transform">
          <Package className="w-4 h-4 text-primary-700" />
          <span className="text-sm font-semibold text-gray-900">View Similar</span>
        </button>

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
        {product.images?.length > 1 && (
          <div className="absolute bottom-16 left-0 right-0 flex justify-center space-x-1.5">
            {product.images.map((_, index) => (
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
      </div>

      {/* Product Title & Price */}
      <div className="bg-white px-4 py-3 border-b border-cream-200">
        <div className="flex items-start justify-between">
          <div className="flex-1 pr-3">
            <h1 className="text-base font-bold text-primary-700 mb-1">
              {product.seller?.businessName || 'Brand'}
            </h1>
            <p className="text-sm text-charcoal-700 leading-snug">
              {product.name}
            </p>
          </div>
          <button className="p-2 -mr-2 active:bg-primary-50 rounded-full transition-colors">
            <Share2 className="w-5 h-5 text-charcoal-700" />
          </button>
        </div>
        
        <div className="mt-2">
          <span className="text-lg font-bold text-charcoal-900">MRP ₹{product.mrp?.toLocaleString() || product.price?.toLocaleString()}</span>
        </div>
      </div>

      {/* Mega Deal Card */}
      {product.mrp && product.mrp > product.price && (
        <div className="bg-warm-50 px-4 py-3 mb-2 border-b border-secondary-100">
          <div className="bg-gradient-to-r from-warm-100 to-cream-100 rounded-lg p-3 flex items-center justify-between border border-secondary-200 shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-secondary-600 to-secondary-700 text-white text-xs font-bold px-2.5 py-1 rounded-md shadow-sm">
                SPECIAL OFFER
              </div>
              <div>
                <span className="text-lg font-bold text-charcoal-900">Get at ₹{product.price?.toLocaleString()}</span>
              </div>
            </div>
            <div className="bg-gradient-to-r from-mint-600 to-mint-700 text-white text-xs font-bold px-3 py-1.5 rounded-md shadow-sm">
              Save ₹{(product.mrp - product.price)?.toLocaleString()}
            </div>
          </div>
          {discount > 0 && (
            <p className="text-xs text-charcoal-600 mt-2">
              With <span className="font-semibold">🏦 Bank Offer</span>
              <button className="text-primary-700 ml-2 font-semibold">Details →</button>
            </p>
          )}
        </div>
      )}

      {/* Size Selection */}
      {product.sizeOptions && product.sizeOptions.length > 0 && (
        <div className="bg-cream-50 px-4 py-4 mb-2 border-b border-primary-100">
          <h3 className="text-sm font-bold text-charcoal-900 mb-3">
            Size: <span className="font-normal text-primary-700">{selectedSize}</span>
          </h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {product.sizeOptions.map((size) => (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all shadow-sm ${
                  selectedSize === size
                    ? 'bg-primary-600 text-white border-2 border-primary-700'
                    : 'bg-white border-2 border-primary-200 text-charcoal-700 hover:border-primary-400'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
          <label className="flex items-center space-x-2 text-sm text-charcoal-600">
            <input type="checkbox" className="w-4 h-4 rounded border-primary-300 text-primary-600 focus:ring-primary-500" />
            <span>Show sizing used by {product.seller?.businessName || 'Brand'}</span>
          </label>
        </div>
      )}

      {/* Price & Delivery Info */}
      <div className="bg-warm-50 px-4 py-4 mb-2 space-y-2 border-b border-secondary-100">
        <div className="text-lg font-bold text-charcoal-900">₹{product.price?.toLocaleString()}</div>
        <div className="text-sm text-charcoal-600">
          Delivery by <span className="font-semibold text-charcoal-900">{deliveryDateStr}</span> - 422001
        </div>
        <div className="text-sm">
          Seller: <span className="font-semibold text-primary-700">{product.seller?.businessName?.toUpperCase() || 'SELLER'}</span>
        </div>
      </div>

      {/* Customization Info */}
      {product.customisable && product.customQuestions && product.customQuestions.length > 0 && (
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
            {product.customQuestions.map((item, index) => {
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
                  {(!item.type || item.type === 'text') ? (
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
          
          {product.codAvailable && (
            <div className="flex items-start space-x-3">
              <Package className="w-5 h-5 text-secondary-700 mt-0.5" strokeWidth={1.5} />
              <div className="flex-1">
                <div className="font-semibold text-sm text-charcoal-900">Pay on Delivery is available</div>
                <div className="text-xs text-charcoal-600 mt-0.5">₹10 additional fee applicable</div>
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
              
              {/* Product Specifications */}
              <div className="pt-4 border-t border-cream-200">
                <h4 className="text-sm font-bold text-charcoal-900 mb-3">Product Specifications</h4>
                <div className="grid grid-cols-2 gap-3">
                  {product.weight && (
                    <div className="bg-gradient-to-br from-cream-50 to-primary-50 border border-primary-200 rounded-lg p-3">
                      <p className="text-xs text-charcoal-600 mb-1">Weight</p>
                      <p className="text-sm font-semibold text-charcoal-900">{product.weight} kg</p>
                    </div>
                  )}
                  {product.stock !== undefined && product.stock !== null && (
                    <div className="bg-gradient-to-br from-primary-50 to-cream-50 border border-primary-200 rounded-lg p-3">
                      <p className="text-xs text-charcoal-600 mb-1">Stock</p>
                      <p className="text-sm font-semibold text-charcoal-900">
                        {product.stock > 0 ? `${product.stock} units` : 'Out of Stock'}
                      </p>
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
                onClick={() => router.push(`/${product.seller?.username || '#'}`)}
                className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-semibold text-sm active:scale-95 transition-all"
              >
                Visit Seller Profile
              </button>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="-mx-4 -my-4">
              <Reviews 
                productId={product.id} 
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
                  <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-2">
                    <img
                      src={item.images?.[0] || '/placeholder-product.png'}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
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
            className="flex-1 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-bold py-3.5 rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all active:scale-95 shadow-md flex items-center justify-center space-x-2"
          >
            <ShoppingBag className="w-5 h-5" />
            <span>BUY NOW</span>
          </button>
        </div>
      </div>

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
