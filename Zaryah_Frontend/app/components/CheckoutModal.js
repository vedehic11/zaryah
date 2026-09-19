'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, MapPin, Plus, CreditCard, Wallet, Building, 
  Truck, Package, AlertCircle, CheckCircle, IndianRupee,
  QrCode, Lock, Info, Copy
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAddress } from '../contexts/AddressContext'
import { useCart } from '../contexts/CartContext'
import { apiService } from '../services/api'
import toast from 'react-hot-toast'
import Script from 'next/script'
import Image from 'next/image'
import OptimizedImage from './OptimizedImage'

async function parseJsonResponse(response) {
  const contentType = response.headers.get('content-type') || ''
  const text = await response.text()

  if (!text.trim()) {
    return null
  }

  if (contentType.includes('application/json')) {
    return JSON.parse(text)
  }

  throw new Error(text.trim().startsWith('<!DOCTYPE') ? 'Server returned an HTML error page' : text.trim())
}

export const CheckoutModal = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth()
  const { addresses, selectedAddress, setSelectedAddress, addAddress } = useAddress()
  const { cart, clearCart, totalPrice } = useCart()

  const [step, setStep] = useState(1) // 1: Address, 2: Payment
  const [loading, setLoading] = useState(false)
  const [showAddAddress, setShowAddAddress] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('online') // online, cod
  const [orderDetails, setOrderDetails] = useState(null)
  const [calculatingDelivery, setCalculatingDelivery] = useState(false)
  const [dynamicDeliveryCharge, setDynamicDeliveryCharge] = useState(null)
  const [showUpiQrModal, setShowUpiQrModal] = useState(false)
  const [pendingUpiOrderData, setPendingUpiOrderData] = useState(null)
  const [utr, setUtr] = useState('')
  const [utrError, setUtrError] = useState('')

  const [newAddress, setNewAddress] = useState({
    fullName: user?.name || '',
    phone: '',
    address: '',
    city: 'Mumbai',
    state: '',
    pincode: '',
    isDefault: addresses.length === 0
  })

  // Calculate totals with dynamic delivery charge
  const subtotal = totalPrice || 0
  const giftPackagingFee = cart.reduce((sum, item) => {
    return sum + (item.giftPackaging ? 10 * item.quantity : 0)
  }, 0)
  const deliveryCharge = dynamicDeliveryCharge !== null ? dynamicDeliveryCharge : (subtotal >= 500 ? 0 : 60)
  const platformFee = subtotal < 500 ? 10 : 20
  const hasTwoWayDelivery = cart.some(item => (
    item.product?.two_way_delivery || item.two_way_delivery || item.twoWayDelivery
  ))
  const total = subtotal + giftPackagingFee + deliveryCharge + platformFee

  const isProd = process.env.NODE_ENV === 'production'
  const debugWarn = (...args) => {
    if (!isProd) console.warn(...args)
  }
  const debugError = (...args) => {
    if (!isProd) console.error(...args)
  }

  // Calculate delivery charge when address changes
  useEffect(() => {
    const calculateDeliveryCharge = async () => {
      if (!selectedAddress?.pincode || !cart || cart.length === 0) {
        setDynamicDeliveryCharge(null)
        return
      }

      setCalculatingDelivery(true)
      try {
        // compute aggregated total weight (kg) and send it to backend
        const totalWeight = cart.reduce((sum, item) => {
          const raw = item.product?.weight || item.weight || item.product?.weight || 700
          // reuse same conversion as backend: grams -> kg when numeric or string
          let w = null
          if (typeof raw === 'number') w = raw / 1000
          else if (typeof raw === 'string' && raw.toLowerCase().includes('g')) w = parseFloat(raw) / 1000
          else if (typeof raw === 'string' && raw.toLowerCase().includes('kg')) w = parseFloat(raw)
          else w = Number(raw) ? Number(raw) / 1000 : 0.7
          return sum + (w * (item.quantity || 1))
        }, 0)

        const response = await fetch('/api/shipping/calculate-rate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deliveryPincode: selectedAddress.pincode,
            totalWeight,
            cartItems: cart.map(item => ({
              product_id: item.product?.id || item.productId,
              seller_id: item.product?.seller_id || item.sellerId,
              weight: item.product?.weight || 700,
              quantity: item.quantity
            })),
            twoWayDelivery: hasTwoWayDelivery,
            codAmount: paymentMethod === 'cod' ? subtotal : 0
          })
        })

        const data = await parseJsonResponse(response)
        if (data.success && data.deliveryCharge !== undefined) {
          setDynamicDeliveryCharge(data.deliveryCharge)
          if (data.fallback) {
            debugWarn('Using fallback delivery charge:', data.error)
          }
        }
      } catch (error) {
        debugError('Failed to calculate delivery charge:', error)
        // Keep using static fallback
      } finally {
        setCalculatingDelivery(false)
      }
    }

    if (selectedAddress) {
      calculateDeliveryCharge()
    }
  }, [selectedAddress, paymentMethod, cart])

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setShowAddAddress(false)
      setDynamicDeliveryCharge(null)
      if (selectedAddress) {
        // Address already selected
      } else if (addresses.length > 0) {
        setSelectedAddress(addresses[0])
      }
    }
  }, [isOpen])

  const handleAddAddress = async () => {
    // Validate
    if (!newAddress.fullName || !newAddress.phone || !newAddress.address || !newAddress.pincode) {
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

    setLoading(true)
    try {
      const added = await addAddress(newAddress)
      setSelectedAddress(added)
      setShowAddAddress(false)
      toast.success('Address added successfully')
    } catch (error) {
      toast.error('Failed to add address')
    } finally {
      setLoading(false)
    }
  }

  const handleProceedToPayment = () => {
    if (!selectedAddress) {
      toast.error('Please select a delivery address')
      return
    }
    setStep(2)
  }

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      toast.error('Please select a delivery address')
      return
    }

    if (!paymentMethod) {
      toast.error('Please select a payment method')
      return
    }

    setLoading(true)

    try {
      const orderData = {
        items: cart.map(item => ({
          productId: item.product.id || item.productId,
          quantity: item.quantity,
          price: item.product.price,
          giftPackaging: item.giftPackaging || false,
          customizations: item.customizations || []
        })),
        address: selectedAddress,
        paymentMethod,
        totalAmount: total,
        deliveryFee: deliveryCharge,
        giftPackagingFee: giftPackagingFee,
        codFee: 0,
        platformFee: platformFee,
        twoWayDelivery: hasTwoWayDelivery
      }

      if (paymentMethod === 'cod') {
        // Create order in database for COD only
        const order = await apiService.createOrder(orderData)
        setOrderDetails(order)

        // COD - order placed successfully
        await clearCart()
        toast.success('Order placed successfully!')
        onSuccess?.(order)
        onClose()
      } else {
        // PhonePe payment
        await initiatePhonePePayment(orderData)
      }

    } catch (error) {
      console.error('Order creation error:', error)
      toast.error(error.message || 'Failed to place order')
    } finally {
      setLoading(false)
    }
  }

  const initiatePhonePePayment = async (orderData) => {
    try {
      // Create pending order record in database first
      const order = await apiService.createOrder({
        ...orderData,
        paymentStatus: 'pending'
      })

      if (!order || !order.id) {
        throw new Error('Failed to create order record. Please try again.')
      }

      console.log('Pending Order created in checkout modal:', order.id)

      // Save order context to sessionStorage for the callback page
      try {
        sessionStorage.setItem('zaryah-pendingOrder', JSON.stringify({
          orderId: order.id
        }))
      } catch (e) {
        console.error('Failed to save pending order to sessionStorage', e)
      }

      // Call backend to create PhonePe payment and get redirect URL
      const paymentData = await apiService.request('/payment/create-order', {
        method: 'POST',
        body: JSON.stringify({
          amount: Math.round(totalPrice * 100),
          orderId: order.id
        })
      })

      if (!paymentData?.redirectUrl) {
        throw new Error('Unable to initiate PhonePe payment. Please try again.')
      }

      // Clear cart
      await clearCart()

      toast.loading('Redirecting to PhonePe...', { duration: 5000 })
      window.location.href = paymentData.redirectUrl
    } catch (error) {
      console.error('PhonePe payment error:', error)
      toast.error(error.message || 'Payment initiation failed')
    }
  }

  if (!isOpen) return null

  return (
    <>

      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Checkout</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Step {step} of 2: {step === 1 ? 'Delivery Address' : 'Payment'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="flex px-6 pt-4">
              <div className={`flex-1 h-1 rounded ${step >= 1 ? 'bg-primary-600' : 'bg-gray-200'}`} />
              <div className={`flex-1 h-1 rounded ml-2 ${step >= 2 ? 'bg-primary-600' : 'bg-gray-200'}`} />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Address/Payment */}
                <div className="lg:col-span-2">
                  {step === 1 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <MapPin className="w-5 h-5" />
                        Select Delivery Address
                      </h3>

                      {/* Existing Addresses */}
                      {addresses.length > 0 && !showAddAddress && (
                        <div className="space-y-3">
                          {addresses.map((addr) => (
                            <div
                              key={addr.id}
                              onClick={() => setSelectedAddress(addr)}
                              className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                                selectedAddress?.id === addr.id
                                  ? 'border-primary-500 bg-primary-50'
                                  : 'border-gray-200 hover:border-primary-300'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-semibold text-gray-900">{addr.fullName}</p>
                                  <p className="text-sm text-gray-600 mt-1">{addr.address}</p>
                                  <p className="text-sm text-gray-600">
                                    {addr.city}, {addr.state} - {addr.pincode}
                                  </p>
                                  <p className="text-sm text-gray-600 mt-1">Phone: {addr.phone}</p>
                                  {addr.isDefault && (
                                    <span className="inline-block mt-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                                      Default
                                    </span>
                                  )}
                                </div>
                                {selectedAddress?.id === addr.id && (
                                  <CheckCircle className="w-5 h-5 text-primary-600" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add New Address Form */}
                      {(showAddAddress || addresses.length === 0) && (
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6">
                          <h4 className="font-semibold mb-4">Add New Address</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                              type="text"
                              placeholder="Full Name *"
                              value={newAddress.fullName}
                              onChange={(e) => setNewAddress({...newAddress, fullName: e.target.value})}
                              className="px-4 py-2 border rounded-lg"
                            />
                            <input
                              type="tel"
                              placeholder="Phone Number *"
                              value={newAddress.phone}
                              onChange={(e) => setNewAddress({...newAddress, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})}
                              className="px-4 py-2 border rounded-lg"
                            />
                            <input
                              type="text"
                              placeholder="Address *"
                              value={newAddress.address}
                              onChange={(e) => setNewAddress({...newAddress, address: e.target.value})}
                              className="md:col-span-2 px-4 py-2 border rounded-lg"
                            />
                            <select
                              value={newAddress.city}
                              onChange={(e) => setNewAddress({...newAddress, city: e.target.value})}
                              className="px-4 py-2 border rounded-lg"
                            >
                              <option>Mumbai</option>
                              <option>Delhi</option>
                              <option>Bangalore</option>
                              <option>Chennai</option>
                              <option>Kolkata</option>
                              <option>Hyderabad</option>
                              <option>Pune</option>
                              <option>Ahmedabad</option>
                            </select>
                            <input
                              type="text"
                              placeholder="State *"
                              value={newAddress.state}
                              onChange={(e) => setNewAddress({...newAddress, state: e.target.value})}
                              className="px-4 py-2 border rounded-lg"
                            />
                            <input
                              type="text"
                              placeholder="Pincode *"
                              value={newAddress.pincode}
                              onChange={(e) => setNewAddress({...newAddress, pincode: e.target.value.replace(/\D/g, '').slice(0, 6)})}
                              className="px-4 py-2 border rounded-lg"
                            />
                          </div>
                          <div className="flex gap-3 mt-4">
                            <button
                              onClick={handleAddAddress}
                              disabled={loading}
                              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                            >
                              {loading ? 'Adding...' : 'Save Address'}
                            </button>
                            {addresses.length > 0 && (
                              <button
                                onClick={() => setShowAddAddress(false)}
                                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Add Address Button */}
                      {addresses.length > 0 && !showAddAddress && (
                        <button
                          onClick={() => setShowAddAddress(true)}
                          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-colors flex items-center justify-center gap-2 text-gray-600 hover:text-primary-600"
                        >
                          <Plus className="w-5 h-5" />
                          Add New Address
                        </button>
                      )}
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <CreditCard className="w-5 h-5" />
                        Select Payment Method
                      </h3>

                      {/* Payment Methods */}
                      <div
                        onClick={() => setPaymentMethod('online')}
                        className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                          paymentMethod === 'online' || paymentMethod === 'razorpay'
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-primary-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CreditCard className="w-6 h-6 text-primary-600" />
                            <div>
                              <p className="font-semibold">Online Payment (PhonePe)</p>
                              <p className="text-sm text-gray-600">PhonePe, Google Pay, Cards, Net Banking</p>
                            </div>
                          </div>
                          {(paymentMethod === 'online' || paymentMethod === 'razorpay') && <CheckCircle className="w-5 h-5 text-primary-600" />}
                        </div>
                      </div>

                      <div
                        onClick={() => setPaymentMethod('cod')}
                        className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                          paymentMethod === 'cod'
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-primary-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Building className="w-6 h-6 text-primary-600" />
                            <div>
                              <p className="font-semibold">Cash on Delivery</p>
                              <p className="text-sm text-gray-600">Pay when you receive (+RTO charges)</p>
                            </div>
                          </div>
                          {paymentMethod === 'cod' && <CheckCircle className="w-5 h-5 text-primary-600" />}
                        </div>
                      </div>

                      {/* Delivery Address Summary */}
                      <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                        <p className="text-sm font-semibold text-gray-700 mb-2">Delivering to:</p>
                        <p className="text-sm text-gray-900 font-medium">{selectedAddress?.fullName}</p>
                        <p className="text-sm text-gray-600">{selectedAddress?.address}</p>
                        <p className="text-sm text-gray-600">
                          {selectedAddress?.city}, {selectedAddress?.state} - {selectedAddress?.pincode}
                        </p>
                        <button
                          onClick={() => setStep(1)}
                          className="text-sm text-primary-600 hover:text-primary-700 mt-2"
                        >
                          Change Address
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Order Summary */}
                <div className="lg:col-span-1">
                  <div className="bg-gray-50 rounded-xl p-6 sticky top-0">
                    <h3 className="text-lg font-semibold mb-4">Order Summary</h3>
                    
                    {/* Cart Items */}
                    <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                      {cart.map((item, index) => (
                        <div key={index} className="flex gap-3">
                          <div className="relative w-16 h-16 flex-shrink-0">
                            <OptimizedImage 
                              src={item.product.images?.[0] || '/placeholder.jpg'} 
                              alt={item.product.name}
                              fill
                              className="object-cover rounded-lg"
                              width={150}
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{item.product.name}</p>
                            <p className="text-xs text-gray-600">Qty: {item.quantity}</p>
                            <p className="text-sm font-semibold text-primary-600">₹{item.product.price * item.quantity}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-gray-200 pt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="font-medium">₹{subtotal.toFixed(2)}</span>
                      </div>
                      {giftPackagingFee > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Gift Packaging</span>
                          <span className="font-medium">₹{giftPackagingFee.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm items-center">
                        <span className="text-gray-600 flex items-center gap-2">
                          Delivery
                          {calculatingDelivery && (
                            <span className="text-xs text-blue-600">calculating...</span>
                          )}
                        </span>
                        <span className="font-medium">
                          {deliveryCharge === 0 ? 'FREE' : `₹${deliveryCharge}`}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Platform Fee</span>
                        <span className="font-medium">₹{platformFee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                        <span>Total</span>
                        <span className="text-primary-600">₹{total.toFixed(2)}</span>
                      </div>
                    </div>

                    {deliveryCharge === 0 ? (
                      <div className="mt-4 p-3 bg-green-50 rounded-lg flex items-start gap-2">
                        <Truck className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-green-800">Yay! You got free delivery</p>
                      </div>
                    ) : (
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-start gap-2">
                        <Package className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-blue-800">
                            {dynamicDeliveryCharge !== null 
                              ? 'Delivery charge based on weight & distance'
                              : 'Standard delivery charge'}
                          </p>
                          {selectedAddress?.pincode && (
                            <p className="text-xs text-blue-600 mt-1">
                              To pincode: {selectedAddress.pincode}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t p-6 bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  {step === 2 && (
                    <button
                      onClick={() => setStep(1)}
                      className="text-sm text-gray-600 hover:text-gray-900"
                    >
                      ← Back to Address
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Total Amount</p>
                    <p className="text-2xl font-bold text-primary-600">₹{total.toFixed(2)}</p>
                  </div>
                  {step === 1 ? (
                    <button
                      onClick={handleProceedToPayment}
                      disabled={!selectedAddress}
                      className="px-8 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Continue to Payment
                    </button>
                  ) : (
                    <button
                      onClick={handlePlaceOrder}
                      disabled={loading || !paymentMethod}
                      className="px-8 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      {loading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Package className="w-5 h-5" />
                          Place Order
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

    
    </>
  )
}
