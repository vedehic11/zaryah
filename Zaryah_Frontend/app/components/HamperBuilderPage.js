'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Package, Gift, Plus, Minus, Trash2, ShoppingBag, Construction, Info, ChevronLeft } from 'lucide-react'
import { ProductCard } from './ProductCard'
import { useCart } from '../contexts/CartContext'
import { useAuth } from '../contexts/AuthContext'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export const HamperBuilderPage = () => {
  const { addToCart } = useCart()
  const { user } = useAuth()
  const router = useRouter()
  const [selectedProducts, setSelectedProducts] = useState([])
  const [hamperName, setHamperName] = useState('')
  const [hamperNote, setHamperNote] = useState('')

  const checkAuthAndRedirect = () => {
    if (!user) {
      router.push('/login');
      return false;
    }
    return true;
  };

  // Sample products for hamper builder
  const availableProducts = [
    {
      id: 1,
      name: 'Artisan Chocolate Box',
      price: 299,
      image: '/placeholder.jpg',
      description: 'Premium handcrafted chocolates'
    },
    {
      id: 2,
      name: 'Aromatherapy Candle Set',
      price: 199,
      image: '/placeholder.jpg',
      description: 'Relaxing lavender and vanilla scents'
    },
    {
      id: 3,
      name: 'Personalized Photo Frame',
      price: 399,
      image: '/placeholder.jpg',
      description: 'Custom engraved wooden frame'
    },
    {
      id: 4,
      name: 'Herbal Tea Collection',
      price: 149,
      image: '/placeholder.jpg',
      description: 'Organic loose leaf tea assortment'
    }
  ]

  const addToHamper = (product) => {
    const existingItem = selectedProducts.find(item => item.product.id === product.id)
    
    if (existingItem) {
      setSelectedProducts(prev => 
        prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      )
    } else {
      setSelectedProducts(prev => [...prev, { product, quantity: 1 }])
    }
  }

  const removeFromHamper = (productId) => {
    setSelectedProducts(prev => prev.filter(item => item.product.id !== productId))
  }

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromHamper(productId)
      return
    }
    
    setSelectedProducts(prev => 
      prev.map(item => 
        item.product.id === productId 
          ? { ...item, quantity: newQuantity }
          : item
      )
    )
  }

  const getTotalPrice = () => {
    return selectedProducts.reduce((total, item) => {
      return total + (item.product.price * item.quantity)
    }, 0)
  }

  const addHamperToCart = () => {
    if (!checkAuthAndRedirect()) return;
    
    selectedProducts.forEach(item => {
      for (let i = 0; i < item.quantity; i++) {
        addToCart(item.product, { giftPackaging: true })
      }
    })
    
    // Reset hamper builder
    setSelectedProducts([])
    setHamperName('')
    setHamperNote('')
    
    toast.success('Hamper added to cart successfully!')
  }

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

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-charcoal-900 font-serif mb-4">Hamper Builder</h1>
          <p className="text-xl text-charcoal-600">Create personalized gift hampers with handcrafted products</p>
        </div>

        {/* Development Notice */}
        <div className="mb-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 shadow-soft">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <Construction className="w-8 h-8 text-yellow-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-800 mb-2 flex items-center">
                  <Info className="w-5 h-5 mr-2" />
                  Under Development
                </h3>
                <p className="text-yellow-700 mb-3">
                  The Hamper Builder feature is currently under development. This is a preview version with sample products. 
                  The full feature with real products and advanced customization options will be available soon.
                </p>
                <div className="bg-yellow-100 rounded-lg p-3">
                  <p className="text-sm text-yellow-800 font-medium">What's Coming:</p>
                  <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                    <li>• Real product integration from our marketplace</li>
                    <li>• Advanced customization and packaging options</li>
                    <li>• Personalized gift messages and cards</li>
                    <li>• Multiple hamper themes and occasions</li>
                    <li>• Direct hamper ordering and delivery</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Available Products */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-charcoal-900 mb-6">Choose Products</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {availableProducts.map((product) => (
                <div key={product.id} className="relative">
                  <ProductCard product={product} />
                  <button
                    onClick={() => addToHamper(product)}
                    className="absolute top-4 right-4 bg-primary-600 hover:bg-primary-700 text-white p-2 rounded-full shadow-soft transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Hamper Builder */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-soft border border-primary-100 p-6 sticky top-8">
              <h2 className="text-2xl font-bold text-charcoal-900 mb-6 flex items-center">
                <Gift className="w-6 h-6 mr-3 text-primary-600" />
                Your Hamper
              </h2>

              {/* Hamper Details */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-charcoal-700 mb-2">
                    Hamper Name
                  </label>
                  <input
                    type="text"
                    value={hamperName}
                    onChange={(e) => setHamperName(e.target.value)}
                    placeholder="e.g., Birthday Surprise Bundle"
                    className="w-full px-3 py-2 border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal-700 mb-2">
                    Personal Note
                  </label>
                  <textarea
                    value={hamperNote}
                    onChange={(e) => setHamperNote(e.target.value)}
                    placeholder="Add a personal message..."
                    rows={3}
                    className="w-full px-3 py-2 border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>

              {/* Selected Products */}
              <div className="space-y-4 mb-6">
                {selectedProducts.length === 0 ? (
                  <div className="text-center py-8 text-charcoal-500">
                    <Package className="w-12 h-12 mx-auto mb-4 text-charcoal-300" />
                    <p>No products selected yet</p>
                    <p className="text-sm">Add products to start building your hamper</p>
                  </div>
                ) : (
                  selectedProducts.map((item) => (
                    <div key={item.product.id} className="flex items-center space-x-3 p-3 bg-cream-50 rounded-lg border border-cream-200">
                      <img
                        src={item.product.image}
                        alt={item.product.name}
                        className="w-12 h-12 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium text-charcoal-900">{item.product.name}</h4>
                        <p className="text-sm text-charcoal-600">₹{item.product.price}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center hover:bg-primary-200 transition-colors"
                        >
                          <Minus className="w-3 h-3 text-primary-600" />
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center hover:bg-primary-200 transition-colors"
                        >
                          <Plus className="w-3 h-3 text-primary-600" />
                        </button>
                        <button
                          onClick={() => removeFromHamper(item.product.id)}
                          className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center hover:bg-red-200 transition-colors"
                        >
                          <Trash2 className="w-3 h-3 text-red-600" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Total and Add to Cart */}
              {selectedProducts.length > 0 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-t border-cream-200">
                    <span className="font-semibold text-charcoal-900">Total:</span>
                    <span className="text-xl font-bold text-primary-600">₹{getTotalPrice()}</span>
                  </div>
                  
                  {/* Add to Cart Button */}
                  <button
                    onClick={addHamperToCart}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center space-x-2"
                  >
                    <ShoppingBag className="w-5 h-5" />
                    <span>Add Hamper to Cart</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}