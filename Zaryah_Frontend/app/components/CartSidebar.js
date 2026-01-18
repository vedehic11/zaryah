'use client'

import { useCart } from '../contexts/CartContext'
import { useAuth } from '../contexts/AuthContext'
import { ShoppingBag, X, Plus, Minus, Trash2, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export const CartSidebar = () => {
  const { cart, isCartOpen, setIsCartOpen, removeFromCart, updateQuantity, totalItems, totalPrice } = useCart()
  const { user } = useAuth()
  const router = useRouter()

  const handleCheckout = () => {
    if (!user) {
      router.push('/login')
      return
    }
    setIsCartOpen(false)
    router.push('/checkout')
  }

  return (
    <div 
      className={`fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ${
        isCartOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
      style={{ transitionProperty: 'transform' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-primary-200 bg-primary-50">
        <div className="flex items-center space-x-3">
          <div className="bg-primary-600 p-2 rounded-lg">
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-lg font-bold text-primary-900">
            Shopping Cart ({totalItems})
          </h2>
        </div>
        <button
          onClick={() => setIsCartOpen(false)}
          className="text-primary-600 hover:text-primary-800 p-2 hover:bg-primary-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-4">
        {cart && cart.length > 0 ? (
          <div className="space-y-4">
            {cart.map((item) => (
              <div key={item.cartItemId || item.id} className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                {/* Product Image */}
                <div className="relative w-20 h-20 flex-shrink-0 bg-gray-200 rounded-lg overflow-hidden">
                  {item.images && item.images.length > 0 ? (
                    <Image
                      src={item.images[0]}
                      alt={item.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBag className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{item.name}</h3>
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-bold text-gray-900">₹{item.price?.toLocaleString()}</p>
                    {item.mrp && item.mrp > item.price && (
                      <>
                        <p className="text-xs text-gray-500 line-through">₹{item.mrp?.toLocaleString()}</p>
                        <span className="text-xs font-semibold text-orange-500">
                          {Math.round(((item.mrp - item.price) / item.mrp) * 100)}% OFF
                        </span>
                      </>
                    )}
                  </div>
                  
                  {/* Quantity Controls */}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => updateQuantity(item.cartItemId || item.id, Math.max(1, item.quantity - 1))}
                      className="p-1 rounded hover:bg-gray-200 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.cartItemId || item.id, item.quantity + 1)}
                      className="p-1 rounded hover:bg-gray-200 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => removeFromCart(item.cartItemId || item.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors self-start"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <ShoppingBag className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-600 mb-4">Your cart is empty</p>
            <Link
              href="/shop"
              onClick={() => setIsCartOpen(false)}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Continue Shopping
            </Link>
          </div>
        )}
      </div>

      {/* Footer with Total and Checkout */}
      {cart && cart.length > 0 && (
        <div className="border-t border-primary-200 p-6 bg-primary-50">
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-semibold text-gray-900">Total:</span>
            <span className="text-xl font-bold text-primary-600">₹{totalPrice?.toLocaleString()}</span>
          </div>
          <button
            onClick={handleCheckout}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 px-6 rounded-xl font-semibold transition-colors flex items-center justify-center space-x-2"
          >
            <span>Proceed to Checkout</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  )
}
