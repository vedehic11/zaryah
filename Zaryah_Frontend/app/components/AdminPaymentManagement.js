'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { DollarSign, CheckCircle, XCircle, RefreshCw, AlertCircle, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { apiService } from '../services/api'

export const AdminPaymentManagement = () => {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending') // all, pending, failed
  const [searchQuery, setSearchQuery] = useState('')
  const [processingOrder, setProcessingOrder] = useState(null)

  useEffect(() => {
    fetchOrders()
  }, [filter])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const response = await apiService.request(`/admin/orders?payment_status=${filter}`)
      setOrders(response.orders || [])
    } catch (error) {
      console.error('Failed to fetch orders:', error)
      toast.error('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyPayment = async (orderId, razorpayPaymentId) => {
    if (!razorpayPaymentId || razorpayPaymentId.trim() === '') {
      toast.error('Please enter Razorpay Payment ID')
      return
    }

    try {
      setProcessingOrder(orderId)
      const result = await apiService.request('/admin/verify-payment', {
        method: 'POST',
        body: JSON.stringify({ orderId, razorpayPaymentId })
      })
      
      toast.success('Payment verified successfully!')
      fetchOrders()
    } catch (error) {
      toast.error(`Verification failed: ${error.message}`)
    } finally {
      setProcessingOrder(null)
    }
  }

  const handleRefund = async (orderId, razorpayPaymentId) => {
    if (!confirm('Are you sure you want to refund this payment?')) return

    try {
      setProcessingOrder(orderId)
      const result = await apiService.request('/admin/refund-payment', {
        method: 'POST',
        body: JSON.stringify({ orderId, razorpayPaymentId })
      })
      
      toast.success('Refund initiated successfully!')
      fetchOrders()
    } catch (error) {
      toast.error(`Refund failed: ${error.message}`)
    } finally {
      setProcessingOrder(null)
    }
  }

  const filteredOrders = orders.filter(order => 
    order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.buyer?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Payment Management</h2>
        <button
          onClick={fetchOrders}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex gap-2">
          {['all', 'pending', 'failed'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
                filter === status
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
        
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by Order ID or Buyer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No orders found
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(order => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Order #{order.id}</h3>
                  <p className="text-sm text-gray-600">Buyer: {order.buyer?.name || 'N/A'}</p>
                  <p className="text-sm text-gray-600">Amount: ₹{order.total_amount}</p>
                  <p className="text-sm text-gray-600">Date: {new Date(order.created_at).toLocaleString()}</p>
                </div>
                
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  order.payment_status === 'paid' 
                    ? 'bg-green-100 text-green-700'
                    : order.payment_status === 'failed'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {order.payment_status}
                </div>
              </div>

              {order.payment_method === 'online' && order.payment_status !== 'paid' && (
                <div className="border-t pt-4 space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter Razorpay Payment ID (pay_xxxxx)"
                      defaultValue={order.razorpay_payment_id || ''}
                      id={`payment-id-${order.id}`}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      onClick={() => {
                        const input = document.getElementById(`payment-id-${order.id}`)
                        handleVerifyPayment(order.id, input.value)
                      }}
                      disabled={processingOrder === order.id}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {processingOrder === order.id ? 'Processing...' : 'Verify'}
                    </button>
                    <button
                      onClick={() => {
                        const input = document.getElementById(`payment-id-${order.id}`)
                        handleRefund(order.id, input.value || order.razorpay_payment_id)
                      }}
                      disabled={processingOrder === order.id || !order.razorpay_payment_id}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Refund
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    <AlertCircle className="w-3 h-3 inline mr-1" />
                    Check Razorpay Dashboard for Payment ID if payment was completed
                  </p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
