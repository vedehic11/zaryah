'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useCart } from '../contexts/CartContext'
import { useAuth } from '../contexts/AuthContext'
import { useAddress } from '../contexts/AddressContext'
import { apiService } from '../services/api'
import { 
  MapPin, Phone, User, CreditCard, Wallet, Package, 
  ArrowLeft, CheckCircle, AlertCircle, Truck, Home 
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function CheckoutPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { cart, clearCart } = useCart()
  const { addresses = [], addAddress, loadUserAddresses } = useAddress()
  
  const [selectedAddress, setSelectedAddress] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState(
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ? 'online' : 'cod'
  ) // 'online' or 'cod'
  const [isProcessing, setIsProcessing] = useState(false)
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [newAddress, setNewAddress] = useState({
    name: user?.name || '',
    phone: '',
    address: '',
    city: 'Mumbai',
    state: '',
    pincode: '',
    isDefault: false
  })

  useEffect(() => {
    if (!user) {
      toast.error('Please login to checkout')
      router.push('/login')
      return
    }

    if (cart.length === 0) {
      toast.error('Your cart is empty')
      router.push('/shop')
      return
    }

    // Auto-select default address if available
    const defaultAddr = addresses.find(addr => addr.isDefault)
    if (defaultAddr) {
      setSelectedAddress(defaultAddr)
    } else if (addresses.length > 0) {
      setSelectedAddress(addresses[0])
    }
  }, [user, cart, addresses, router])

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const giftPackagingFee = cart.filter(item => item.giftPackaging).length * 50
  const deliveryFee = subtotal >= 500 ? 0 : 40
  const codFee = paymentMethod === 'cod' ? 10 : 0
  const total = subtotal + giftPackagingFee + deliveryFee + codFee

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      toast.error('Please select a delivery address')
      return
    }

    setIsProcessing(true)
    console.log('=== Starting Order Process ===')

    try {
      // Format address string
      console.log('Step 1: Formatting address...')
      const addressString = `${selectedAddress.name}, ${selectedAddress.address}, ${selectedAddress.city}, ${selectedAddress.state} - ${selectedAddress.pincode}. Phone: ${selectedAddress.phone}`
      
      // Create order
      const orderData = {
        items: cart.map(item => ({
          productId: item.id || item._id,
          quantity: item.quantity,
          giftPackaging: item.giftPackaging || false,
          customizations: item.customizations || []
        })),
        address: addressString,
        paymentMethod,
        totalAmount: total
      }

      console.log('Step 2: Creating order with data:', orderData)

      const responseData = await apiService.request('/orders', {
        method: 'POST',
        body: JSON.stringify(orderData)
      })

      console.log('Step 3: Order created successfully:', responseData)
      
      if (!responseData || !responseData.order) {
        throw new Error('Invalid response from server')
      }
      
      const { order } = responseData
      console.log('Order ID:', order.id)

      if (paymentMethod === 'online') {
        console.log('Step 4: Initiating online payment...')
        
        // Check if Razorpay is configured
        if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
          console.error('Razorpay not configured')
          toast.error('Online payment is not available. Please use Cash on Delivery.')
          setIsProcessing(false)
          return
        }
        
        // Initialize Razorpay payment
        const paymentData = await apiService.request('/payment/create-order', {
          method: 'POST',
          body: JSON.stringify({ orderId: order.id, amount: total })
        })

        console.log('Step 5: Payment order created:', paymentData)
        const { order_id: razorpayOrderId } = paymentData

        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: total * 100,
          currency: 'INR',
          name: 'Zaryah',
          description: 'Order Payment',
          order_id: razorpayOrderId,
          handler: async function (response) {
            console.log('Payment successful:', response)
            
            try {
              // Verify payment on backend
              await apiService.request('/payment/verify', {
                method: 'PATCH',
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  order_id: order.id
                })
              })
              
              toast.success('Payment successful!')
              clearCart()
              router.push(`/orders`)
            } catch (error) {
              console.error('Payment verification failed:', error)
              toast.error('Payment verification failed. Please contact support.')
            }
          },
          prefill: {
            name: user.name,
            email: user.email,
            contact: selectedAddress.phone
          },
          theme: {
            color: '#B8860B'
          },
          modal: {
            ondismiss: function() {
              console.log('Payment dismissed by user')
              setIsProcessing(false)
              toast.error('Payment cancelled')
            }
          }
        }

        console.log('Step 6: Opening Razorpay modal...')
        const razorpay = new window.Razorpay(options)
        razorpay.open()
        
        // Don't set isProcessing to false here as payment modal is open
        return
      } else {
        console.log('Step 4: COD order complete')
        
        // Show success message first
        toast.success('Order placed successfully!')
        
        // Clear cart (backend already cleared it, this is for frontend state)
        console.log('Step 5: Clearing frontend cart state...')
        try {
          await clearCart()
        } catch (cartError) {
          console.error('Cart clear error (non-critical):', cartError)
          // Don't fail the order if cart clear fails
        }
        
        console.log('Step 6: Redirecting to orders page...')
        // Use setTimeout to ensure UI updates before navigation
        setTimeout(() => {
          setIsProcessing(false)
          router.push('/orders')
        }, 1000)
      }
    } catch (error) {
      console.error('=== Order Process Failed ===')
      console.error('Error:', error)
      const errorMessage = error.message || 'Failed to place order. Please try again.'
      toast.error(errorMessage)
      setIsProcessing(false)
    }
  }

  if (!user || cart.length === 0) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 via-white to-primary-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center text-primary-700 hover:text-primary-800 mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </button>
          <h1 className="text-3xl font-bold text-charcoal-900">Checkout</h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Address & Payment */}
          <div className="lg:col-span-2 space-y-6">
            {/* Delivery Address */}
            <div className="bg-white rounded-xl shadow-soft p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-charcoal-900 flex items-center">
                  <Home className="w-6 h-6 mr-2 text-primary-600" />
                  Delivery Address
                </h2>
                <button
                  onClick={() => setShowAddressForm(!showAddressForm)}
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  + Add New
                </button>
              </div>

              {/* New Address Form */}
              {showAddressForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 p-4 border-2 border-primary-300 rounded-lg bg-primary-50"
                >
                  <h3 className="font-semibold text-charcoal-900 mb-3">Add New Address</h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Full Name"
                        value={newAddress.name}
                        onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <input
                        type="tel"
                        placeholder="Phone Number"
                        value={newAddress.phone}
                        onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <textarea
                      placeholder="Address (House No, Building, Street, Area)"
                      value={newAddress.address}
                      onChange={(e) => setNewAddress({ ...newAddress, address: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="City"
                        value={newAddress.city}
                        onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <input
                        type="text"
                        placeholder="State"
                        value={newAddress.state}
                        onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Pincode"
                      value={newAddress.pincode}
                      onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isDefault"
                        checked={newAddress.isDefault}
                        onChange={(e) => setNewAddress({ ...newAddress, isDefault: e.target.checked })}
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <label htmlFor="isDefault" className="text-sm text-charcoal-700">
                        Set as default address
                      </label>
                    </div>
                    <div className="flex space-x-3">
                      <button
                        onClick={async () => {
                          // Validate
                          if (!newAddress.name || !newAddress.phone || !newAddress.address || !newAddress.city || !newAddress.pincode) {
                            toast.error('Please fill all required fields')
                            return
                          }
                          
                          if (newAddress.phone.length !== 10) {
                            toast.error('Please enter valid 10-digit phone number')
                            return
                          }

                          if (newAddress.pincode.length !== 6) {
                            toast.error('Please enter valid 6-digit pincode')
                            return
                          }

                          try {
                            // Use context method to add address
                            const savedAddress = await addAddress(newAddress)
                            
                            if (savedAddress) {
                              setSelectedAddress(savedAddress)
                              setShowAddressForm(false)
                              
                              // Reset form
                              setNewAddress({
                                name: user?.name || '',
                                phone: '',
                                address: '',
                                city: 'Mumbai',
                                state: '',
                                pincode: '',
                                isDefault: false
                              })
                              
                              // Reload addresses to ensure we have the latest
                              await loadUserAddresses()
                            }
                          } catch (error) {
                            console.error('Error saving address:', error)
                            toast.error('Failed to save address')
                          }
                        }}
                        className="flex-1 bg-primary-600 text-white py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors"
                      >
                        Save Address
                      </button>
                      <button
                        onClick={() => setShowAddressForm(false)}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-charcoal-700 hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Saved Addresses */}
              <div className="space-y-3">
                {addresses.map((address) => (
                  <div
                    key={address.id}
                    onClick={() => setSelectedAddress(address)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedAddress?.id === address.id
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-gray-200 hover:border-primary-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <User className="w-4 h-4 text-charcoal-700" />
                          <span className="font-semibold text-charcoal-900">
                            {address.name}
                          </span>
                          {address.isDefault && (
                            <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-charcoal-700 mb-1">{address.address}</p>
                        <p className="text-sm text-charcoal-600">
                          {address.city}, {address.state} - {address.pincode}
                        </p>
                        <div className="flex items-center text-sm text-charcoal-600 mt-2">
                          <Phone className="w-4 h-4 mr-1" />
                          {address.phone}
                        </div>
                      </div>
                      {selectedAddress?.id === address.id && (
                        <CheckCircle className="w-6 h-6 text-primary-600" />
                      )}
                    </div>
                  </div>
                ))}

                {addresses.length === 0 && !showAddressForm && (
                  <div className="text-center py-8 text-charcoal-600">
                    <MapPin className="w-12 h-12 mx-auto mb-2 text-charcoal-400" />
                    <p>No saved addresses</p>
                    <button
                      onClick={() => setShowAddressForm(true)}
                      className="text-primary-600 hover:text-primary-700 font-medium mt-2"
                    >
                      Add your first address
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-xl shadow-soft p-6">
              <h2 className="text-xl font-bold text-charcoal-900 flex items-center mb-4">
                <Wallet className="w-6 h-6 mr-2 text-primary-600" />
                Payment Method
              </h2>

              <div className="space-y-3">
                <div
                  onClick={() => {
                    if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
                      toast.error('Online payment is not available at the moment. Please use Cash on Delivery.')
                      return
                    }
                    setPaymentMethod('online')
                  }}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID 
                      ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                      : paymentMethod === 'online'
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-200 hover:border-primary-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <CreditCard className="w-5 h-5 text-primary-600" />
                      <div>
                        <p className="font-semibold text-charcoal-900 flex items-center gap-2">
                          Online Payment
                          {!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID && (
                            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">Coming Soon</span>
                          )}
                        </p>
                        <p className="text-sm text-charcoal-600">
                          Credit/Debit Card, UPI, Netbanking
                        </p>
                      </div>
                    </div>
                    {paymentMethod === 'online' && (
                      <CheckCircle className="w-6 h-6 text-primary-600" />
                    )}
                  </div>
                </div>

                <div
                  onClick={() => setPaymentMethod('cod')}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    paymentMethod === 'cod'
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-200 hover:border-primary-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Package className="w-5 h-5 text-secondary-600" />
                      <div>
                        <p className="font-semibold text-charcoal-900">Cash on Delivery</p>
                        <p className="text-sm text-charcoal-600">Pay when you receive (₹10 extra)</p>
                      </div>
                    </div>
                    {paymentMethod === 'cod' && (
                      <CheckCircle className="w-6 h-6 text-primary-600" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-soft p-6 sticky top-8">
              <h2 className="text-xl font-bold text-charcoal-900 mb-4">Order Summary</h2>

              {/* Cart Items */}
              <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.cartItemId} className="flex items-center space-x-3">
                    <img
                      src={item.images?.[0] || '/placeholder.jpg'}
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-charcoal-900 text-sm line-clamp-1">
                        {item.name}
                      </p>
                      <p className="text-sm text-charcoal-600">
                        Qty: {item.quantity} × ₹{item.price}
                      </p>
                      {item.giftPackaging && (
                        <p className="text-xs text-secondary-600">+ Gift Packaging</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 pt-4 space-y-2">
                <div className="flex justify-between text-charcoal-700">
                  <span>Subtotal</span>
                  <span>₹{subtotal}</span>
                </div>
                {giftPackagingFee > 0 && (
                  <div className="flex justify-between text-charcoal-700">
                    <span>Gift Packaging</span>
                    <span>₹{giftPackagingFee}</span>
                  </div>
                )}
                <div className="flex justify-between text-charcoal-700">
                  <span>Delivery Fee</span>
                  <span>{deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}</span>
                </div>
                {codFee > 0 && (
                  <div className="flex justify-between text-charcoal-700">
                    <span>COD Fee</span>
                    <span>₹{codFee}</span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-2 flex justify-between text-lg font-bold text-charcoal-900">
                  <span>Total</span>
                  <span>₹{total}</span>
                </div>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={!selectedAddress || isProcessing}
                className="w-full mt-6 bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Processing...' : 'Place Order'}
              </button>

              {!selectedAddress && (
                <div className="mt-4 flex items-start space-x-2 text-amber-700 bg-amber-50 p-3 rounded-lg">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm">Please select a delivery address</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
