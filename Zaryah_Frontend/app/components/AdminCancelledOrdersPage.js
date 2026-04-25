'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, XCircle, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import { apiService } from '../services/api'

export const AdminCancelledOrdersPage = () => {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [processingOrderId, setProcessingOrderId] = useState(null)

  const fetchCancelledOrders = async () => {
    try {
      setLoading(true)
      const response = await apiService.request('/orders?userType=admin&status=cancelled')
      setOrders(Array.isArray(response) ? response : [])
    } catch (error) {
      console.error('Failed to fetch cancelled orders:', error)
      toast.error('Failed to load cancelled orders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCancelledOrders()
  }, [])

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return orders

    return orders.filter((order) => {
      const idText = String(order.id || '').toLowerCase()
      const awbText = String(order.awb_code || '').toLowerCase()
      const shipmentText = String(order.shipment_id || '').toLowerCase()
      const statusText = String(order.shipment_status || '').toLowerCase()

      return (
        idText.includes(query) ||
        awbText.includes(query) ||
        shipmentText.includes(query) ||
        statusText.includes(query)
      )
    })
  }, [orders, searchQuery])

  const getRefundStatus = (order) => {
    const paymentMethod = String(order?.payment_method || '').toLowerCase()
    const paymentStatus = String(order?.payment_status || '').toLowerCase()

    if (paymentMethod !== 'online') {
      return { label: 'Not Applicable', className: 'text-gray-600' }
    }

    if (paymentStatus === 'refunded') {
      return { label: 'Refunded', className: 'text-green-600' }
    }

    if (paymentStatus === 'paid') {
      return { label: 'Pending Refund', className: 'text-amber-600' }
    }

    return { label: 'Pending Review', className: 'text-amber-600' }
  }

  const handleMarkRefunded = async (order) => {
    if (!order?.id) return

    if (!confirm('Mark this order as refunded after manual refund?')) {
      return
    }

    const manualReference = prompt('Enter manual refund reference (optional):')

    try {
      setProcessingOrderId(order.id)
      await apiService.request('/admin/refund-payment', {
        method: 'POST',
        body: JSON.stringify({
          orderId: order.id,
          manualRefund: true,
          manualReference: manualReference?.trim() || undefined,
          reason: 'Manual refund processed outside application'
        })
      })

      toast.success('Refund status updated')
      await fetchCancelledOrders()
    } catch (error) {
      console.error('Failed to mark refund:', error)
      toast.error(error.message || 'Failed to update refund status')
    } finally {
      setProcessingOrderId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Cancelled Orders</h2>
          <p className="text-sm text-gray-600">
            Use this list to tally cancelled orders with Shiprocket shipment records.
          </p>
        </div>

        <button
          onClick={fetchCancelledOrders}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by order ID, AWB, shipment ID, status"
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="text-sm text-gray-600">
          Total Cancelled: <span className="font-semibold text-gray-900">{filteredOrders.length}</span>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <XCircle className="w-14 h-14 mx-auto mb-3 text-gray-400" />
          <p>No cancelled orders found</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full min-w-[1120px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Order</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Cancelled On</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Payment</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Refund Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Shipment ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">AWB</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Shipment Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredOrders.map((order) => (
                <motion.tr
                  key={order.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-gray-900">
                      #{order.id?.slice(-8)?.toUpperCase() || 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500 break-all">{order.id}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {order.updated_at
                      ? new Date(order.updated_at).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                    ₹{Number(order.total_amount || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-800">{order.payment_method || '-'}</div>
                    <div className={`text-xs font-medium ${
                      order.payment_status === 'refunded' ? 'text-green-600' : 'text-amber-600'
                    }`}>
                      {order.payment_status || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const refundStatus = getRefundStatus(order)
                      const canMarkManually = String(order?.payment_method || '').toLowerCase() === 'online' && String(order?.payment_status || '').toLowerCase() !== 'refunded'
                      return (
                        <div className="flex flex-col gap-2 items-start">
                          <span className={`text-xs font-semibold ${refundStatus.className}`}>
                            {refundStatus.label}
                          </span>
                          {canMarkManually && (
                            <button
                              onClick={() => handleMarkRefunded(order)}
                              disabled={processingOrderId === order.id}
                              className="px-2.5 py-1 text-xs font-medium border border-emerald-300 text-emerald-700 rounded-md hover:bg-emerald-50 disabled:opacity-50"
                            >
                              {processingOrderId === order.id ? 'Updating...' : 'Mark Refunded'}
                            </button>
                          )}
                        </div>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 font-mono">
                    {order.shipment_id || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 font-mono">
                    {order.awb_code || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 text-gray-800 text-xs font-medium">
                      <Package className="w-3.5 h-3.5" />
                      {order.shipment_status || 'N/A'}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
