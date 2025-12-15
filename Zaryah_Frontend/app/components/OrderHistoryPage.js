'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiService } from '../services/api'
import { motion } from 'framer-motion'
import { 
  Package, 
  Clock, 
  MapPin, 
  MessageSquare, 
  Eye, 
  Truck, 
  CheckCircle, 
  AlertCircle,
  Calendar,
  DollarSign,
  User,
  ShoppingBag,
  Star,
  Phone,
  Mail,
  Image,
  ThumbsUp
} from 'lucide-react'
import { CreateSupportTicket } from './CreateSupportTicket'
import { ReviewModal } from './ReviewModal'
import toast from 'react-hot-toast'

export const OrderHistoryPage = () => {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [showOrderDetails, setShowOrderDetails] = useState(false)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [filter, setFilter] = useState('all') // all, pending, confirmed, dispatched, delivered, cancelled

  useEffect(() => {
    if (!user) return
    setLoading(true)
    apiService.getOrdersForBuyer(user.id)
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }, [user])

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'confirmed': return 'bg-blue-100 text-blue-800'
      case 'dispatched': return 'bg-purple-100 text-purple-800'
      case 'delivered': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return Clock
      case 'confirmed': return CheckCircle
      case 'dispatched': return Truck
      case 'delivered': return CheckCircle
      case 'cancelled': return AlertCircle
      default: return Package
    }
  }

  const getOrderProgress = (status) => {
    const steps = [
      { name: 'Order Placed', completed: true },
      { name: 'Confirmed', completed: ['confirmed', 'dispatched', 'delivered'].includes(status) },
      { name: 'Dispatched', completed: ['dispatched', 'delivered'].includes(status) },
      { name: 'Delivered', completed: status === 'delivered' }
    ]
    return steps
  }

  const handleRaiseIssue = (order) => {
    setSelectedOrder(order)
    setShowSupportModal(true)
  }

  const handleWriteReview = (product, order) => {
    setSelectedProduct(product)
    setSelectedOrder(order)
    setShowReviewModal(true)
  }

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true
    return order.status === filter
  })

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount)
  }

  const getProductImage = (product) => {
    // Check if product has images array and first image
    if (product.images && product.images.length > 0) {
      return product.images[0]
    }
    // Check if product has a single image field
    if (product.image) {
      return product.image
    }
    // Return a placeholder if no image
    return null
  }

  const renderStars = (rating) => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream-50 to-primary-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 to-primary-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-charcoal-900 font-serif mb-2">Order History</h1>
          <p className="text-charcoal-600">Track your orders and manage any issues</p>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-xl shadow-soft border border-primary-100 p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all', label: 'All Orders', count: orders.length },
              { key: 'pending', label: 'Pending', count: orders.filter(o => o.status === 'pending').length },
              { key: 'confirmed', label: 'Confirmed', count: orders.filter(o => o.status === 'confirmed').length },
              { key: 'dispatched', label: 'Dispatched', count: orders.filter(o => o.status === 'dispatched').length },
              { key: 'delivered', label: 'Delivered', count: orders.filter(o => o.status === 'delivered').length },
              { key: 'cancelled', label: 'Cancelled', count: orders.filter(o => o.status === 'cancelled').length }
            ].map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === key
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-charcoal-600 hover:bg-gray-200'
                }`}
              >
                {label} ({count})
              </button>
            ))}
          </div>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-soft border border-primary-100 p-8 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-charcoal-900 mb-2">No orders found</h3>
            <p className="text-charcoal-600">You haven't placed any orders yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredOrders.map((order, index) => (
              <motion.div
                key={order._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl shadow-soft border border-primary-100 overflow-hidden"
              >
                {/* Order Header */}
                <div className="p-6 border-b border-primary-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="bg-primary-100 p-2 rounded-lg">
                        <Package className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-charcoal-900">
                          Order #{order.orderId || order._id.slice(-8).toUpperCase()}
                        </h3>
                        <p className="text-sm text-charcoal-600">
                          Placed on {formatDate(order.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(order.status)}`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedOrder(order)
                          setShowOrderDetails(!showOrderDetails)
                        }}
                        className="p-2 text-charcoal-500 hover:text-primary-600 transition-colors"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Order Progress */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between">
                      {getOrderProgress(order.status).map((step, stepIndex) => (
                        <div key={step.name} className="flex items-center">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                            step.completed 
                              ? 'bg-primary-600 border-primary-600 text-white' 
                              : 'bg-gray-100 border-gray-300 text-gray-400'
                          }`}>
                            {step.completed ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <span className="text-xs font-bold">{stepIndex + 1}</span>
                            )}
                          </div>
                          {stepIndex < getOrderProgress(order.status).length - 1 && (
                            <div className={`flex-1 h-0.5 mx-2 ${
                              step.completed ? 'bg-primary-600' : 'bg-gray-300'
                            }`} />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-charcoal-500 mt-2">
                      {getOrderProgress(order.status).map(step => (
                        <span key={step.name} className="text-center">{step.name}</span>
                      ))}
                    </div>
                  </div>

                  {/* Quick Info */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-charcoal-600">
                        Total: <span className="font-semibold">{formatCurrency(order.totalAmount)}</span>
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-charcoal-600">
                        Seller: <span className="font-semibold">
                          {order.seller?.businessName || order.seller?.fullName || 'Unknown'}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <ShoppingBag className="w-4 h-4 text-purple-600" />
                      <span className="text-sm text-charcoal-600">
                        Items: <span className="font-semibold">{order.products?.length || 0}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Order Details (Expandable) */}
                {showOrderDetails && selectedOrder?._id === order._id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-t border-primary-100"
                  >
                    <div className="p-6">
                      {/* Products List */}
                      <div className="mb-6">
                        <h4 className="text-lg font-semibold text-charcoal-900 mb-4">Order Items</h4>
                        <div className="space-y-3">
                          {order.products?.map((product, productIndex) => {
                            const productImage = getProductImage(product)
                            return (
                              <div key={product._id || productIndex} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                                {/* Product Image */}
                                <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 flex items-center justify-center">
                                  {productImage ? (
                                    <img 
                                      src={productImage} 
                                      alt={product.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.target.style.display = 'none'
                                        e.target.nextSibling.style.display = 'flex'
                                      }}
                                    />
                                  ) : null}
                                  <div className="w-full h-full flex items-center justify-center text-gray-400" style={{ display: productImage ? 'none' : 'flex' }}>
                                    <Image className="w-6 h-6" />
                                  </div>
                                </div>
                                
                                {/* Product Details */}
                                <div className="flex-1">
                                  <h5 className="font-medium text-charcoal-900">{product.name}</h5>
                                  <p className="text-sm text-charcoal-600">
                                    Quantity: {product.quantity || 1} × {formatCurrency(product.price)}
                                  </p>
                                  {product.description && (
                                    <p className="text-xs text-charcoal-500 mt-1 line-clamp-2">
                                      {product.description}
                                    </p>
                                  )}
                                </div>
                                
                                {/* Price */}
                                <div className="text-right">
                                  <p className="font-semibold text-charcoal-900">
                                    {formatCurrency((product.quantity || 1) * product.price)}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Order Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                          <h4 className="text-lg font-semibold text-charcoal-900 mb-3">Order Details</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-charcoal-600">Order ID:</span>
                              <span className="font-medium">{order.orderId || order._id}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-charcoal-600">Order Date:</span>
                              <span className="font-medium">{formatDate(order.createdAt)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-charcoal-600">Payment Method:</span>
                              <span className="font-medium">{order.paymentMethod || 'Online Payment'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-charcoal-600">Delivery Address:</span>
                              <span className="font-medium text-right max-w-xs">
                                {order.deliveryAddress?.address || 'Address not available'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-lg font-semibold text-charcoal-900 mb-3">Seller Information</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-charcoal-600">Business Name:</span>
                              <span className="font-medium">{order.seller?.businessName || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-charcoal-600">Contact:</span>
                              <span className="font-medium">{order.seller?.primaryMobile || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-charcoal-600">Location:</span>
                              <span className="font-medium">{order.seller?.businessAddress || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-3 pt-4 border-t border-primary-100">
                        <button
                          onClick={() => handleRaiseIssue(order)}
                          className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>Raise Issue</span>
                        </button>
                        
                        {order.status === 'delivered' && (
                          <button 
                            onClick={() => handleWriteReview(order.products[0], order)}
                            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                          >
                            <Star className="w-4 h-4" />
                            <span>Write Review</span>
                          </button>
                        )}
                        
                        <button className="flex items-center space-x-2 px-4 py-2 border border-primary-300 text-primary-700 rounded-lg hover:bg-primary-50 transition-colors">
                          <Phone className="w-4 h-4" />
                          <span>Contact Seller</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* Support Modal */}
        <CreateSupportTicket
          isOpen={showSupportModal}
          onClose={() => {
            setShowSupportModal(false)
            setSelectedOrder(null)
          }}
          orders={selectedOrder ? [selectedOrder] : []}
          prefillData={selectedOrder ? {
            subject: `Issue with Order #${selectedOrder.orderId || selectedOrder._id.slice(-8).toUpperCase()}`,
            description: `I have an issue with my order:\n\nOrder Details:\n- Order ID: ${selectedOrder.orderId || selectedOrder._id}\n- Order Date: ${formatDate(selectedOrder.createdAt)}\n- Total Amount: ${formatCurrency(selectedOrder.totalAmount)}\n- Status: ${selectedOrder.status}\n- Seller: ${selectedOrder.seller?.businessName || selectedOrder.seller?.fullName || 'Unknown'}\n\nProducts:\n${selectedOrder.products?.map(p => `- ${p.name} (${p.quantity || 1} × ${formatCurrency(p.price)})`).join('\n')}`,
            orderReference: selectedOrder._id,
            category: 'product',
            issueTiming: `When I received the order on ${formatDate(selectedOrder.createdAt)}`,
            urgencyLevel: 'medium'
          } : undefined}
        />

        {/* Review Modal */}
        <ReviewModal
          isOpen={showReviewModal}
          onClose={() => {
            setShowReviewModal(false)
            setSelectedProduct(null)
            setSelectedOrder(null)
          }}
          product={selectedProduct}
          orderId={selectedOrder?.orderId || selectedOrder?._id}
        />
      </div>
    </div>
  )
}