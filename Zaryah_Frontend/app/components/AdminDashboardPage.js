'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Users, 
  CheckCircle,
  Clock,
  Wallet,
  DollarSign,
  TrendingUp,
  ArrowUpCircle,
  IndianRupee,
  XCircle,
  AlertCircle,
  Star,
  MessageSquare,
  Package
} from 'lucide-react'
import { apiService } from '../services/api'
import { useRouter } from 'next/navigation'
import { useAuth } from '../contexts/AuthContext'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { AdminSellerManagementPage } from './AdminSellerManagementPage'
import { AdminSupportPage } from './AdminSupportPage'
import { AdminPaymentManagement } from './AdminPaymentManagement'
import { AdminCancelledOrdersPage } from './AdminCancelledOrdersPage'

export const AdminDashboardPage = () => {
  const { user, isLoading } = useAuth()
  const [stats, setStats] = useState({
    totalSellers: 0,
    pendingSellers: 0,
    approvedSellers: 0,
    totalProducts: 0,
    pendingProducts: 0,
    approvedProducts: 0,
    totalOrders: 0,
    totalRevenue: 0
  })
  const [loading, setLoading] = useState(true)
  const [sellerView, setSellerView] = useState('pending') // 'pending' or 'all'
  const [activeTab, setActiveTab] = useState('sellers') // sellers, withdrawals, earnings, support
  const [withdrawals, setWithdrawals] = useState([])
  const [earnings, setEarnings] = useState(null)
  const router = useRouter()

  useEffect(() => {
    // Only fetch when user is loaded and authenticated as admin
    if (!isLoading && user?.userType === 'Admin') {
      fetchDashboardStats()
    } else if (!isLoading) {
      setLoading(false)
      toast.error('Admin access required')
    }
  }, [user, isLoading])

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)
      
      // Fetch sellers (admin endpoint)
      const sellers = await apiService.getSellersForAdmin()
      const pendingSellers = sellers.filter(s => !s.users?.is_approved).length
      const approvedSellers = sellers.filter(s => s.users?.is_approved).length

      setStats({
        totalSellers: sellers.length,
        pendingSellers,
        approvedSellers,
        totalProducts: 0,
        pendingProducts: 0,
        approvedProducts: 0,
        totalOrders: 0,
        totalRevenue: 0
      })
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
      toast.error('Failed to load dashboard statistics')
    } finally {
      setLoading(false)
    }
  }

  const fetchWithdrawals = async (status = null) => {
    try {
      const data = await apiService.getAdminWithdrawals(status)
      setWithdrawals(data.withdrawals || [])
    } catch (error) {
      console.error('Error fetching withdrawals:', error)
      toast.error('Failed to load withdrawal requests')
    }
  }

  const fetchEarnings = async (period = 'all') => {
    try {
      const data = await apiService.getAdminEarnings(period)
      setEarnings(data)
    } catch (error) {
      console.error('Error fetching earnings:', error)
      toast.error('Failed to load earnings data')
    }
  }

  const handleApproveWithdrawal = async (withdrawalId) => {
    try {
      const manualTransactionId = prompt('Enter manual bank transaction ID / UTR:')
      if (!manualTransactionId || !manualTransactionId.trim()) {
        toast.error('Manual transaction ID is required')
        return
      }

      await apiService.approveWithdrawal(withdrawalId, 'approve', null, manualTransactionId.trim())
      toast.success('Withdrawal approved and marked as paid manually.')
      fetchWithdrawals() // Refresh list
    } catch (error) {
      toast.error(error.message || 'Failed to approve withdrawal')
    }
  }

  const handleRejectWithdrawal = async (withdrawalId, reason) => {
    try {
      await apiService.approveWithdrawal(withdrawalId, 'reject', reason)
      toast.success('Withdrawal rejected')
      fetchWithdrawals() // Refresh list
    } catch (error) {
      toast.error(error.message || 'Failed to reject withdrawal')
    }
  }

  // Fetch data when tab changes
  useEffect(() => {
    if (activeTab === 'withdrawals') {
      fetchWithdrawals('pending')
    } else if (activeTab === 'earnings') {
      fetchEarnings('month')
    }
  }, [activeTab])

  const statCards = [
    {
      title: 'Total Sellers',
      value: stats.totalSellers,
      icon: Users,
      color: 'blue',
      link: '/admin/sellers'
    },
    {
      title: 'Pending Approvals',
      value: stats.pendingSellers,
      icon: Clock,
      color: 'yellow',
      link: '/admin/sellers?status=pending'
    },
    {
      title: 'Approved Sellers',
      value: stats.approvedSellers,
      icon: CheckCircle,
      color: 'green',
      link: '/admin/sellers?status=approved'
    }
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Stats Grid - Balanced Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {statCards.map((stat, index) => {
            const Icon = stat.icon
            const colorClasses = {
              blue: 'bg-blue-100 text-blue-600',
              yellow: 'bg-yellow-100 text-yellow-600',
              green: 'bg-green-100 text-green-600',
              orange: 'bg-orange-100 text-orange-600',
              purple: 'bg-purple-100 text-purple-600'
            }

            return (
              <Link key={stat.title} href={stat.link}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="h-full bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 p-7 border border-gray-100 cursor-pointer group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-500 tracking-wide uppercase">{stat.title}</p>
                      <p className="text-4xl font-bold text-gray-900 mt-2">{stat.value}</p>
                    </div>
                    <div className={`p-4 rounded-xl ${colorClasses[stat.color]} group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="w-7 h-7" />
                    </div>
                  </div>
                </motion.div>
              </Link>
            )
          })}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {[
                { id: 'sellers', label: 'Seller Management', icon: Users },
                { id: 'cancelled-orders', label: 'Cancelled Orders', icon: XCircle },
                { id: 'payments', label: 'Payment Issues', icon: AlertCircle },
                { id: 'withdrawals', label: 'Withdrawals', icon: Wallet },
                { id: 'earnings', label: 'Commission Earnings', icon: DollarSign },
                { id: 'support', label: 'Support Tickets', icon: MessageSquare }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Sellers Tab */}
          {activeTab === 'sellers' && (
            <div className="p-6">
              {/* View Toggle */}
              <div className="flex justify-center mb-6">
                <div className="bg-gray-50 rounded-xl p-2 inline-flex gap-2">
                  <button
                    onClick={() => setSellerView('pending')}
                    className={`px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                      sellerView === 'pending'
                        ? 'bg-yellow-500 text-white shadow-md'
                        : 'text-gray-700 hover:text-gray-900'
                    }`}
                  >
                    <Clock className="w-5 h-5" />
                    <span>Pending</span>
                  </button>
                  <button
                    onClick={() => setSellerView('all')}
                    className={`px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                      sellerView === 'all'
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'text-gray-700 hover:text-gray-900'
                    }`}
                  >
                    <Users className="w-5 h-5" />
                    <span>All</span>
                  </button>
                </div>
              </div>
              <AdminSellerManagementPage initialView={sellerView} />
            </div>
          )}

          {/* Payment Issues Tab */}
          {activeTab === 'payments' && (
            <div className="p-6">
              <AdminPaymentManagement />
            </div>
          )}

          {/* Cancelled Orders Tab */}
          {activeTab === 'cancelled-orders' && (
            <div className="p-6">
              <AdminCancelledOrdersPage />
            </div>
          )}

          {/* Withdrawals Tab */}
          {activeTab === 'withdrawals' && (
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Seller Withdrawal Requests</h2>
                <select
                  onChange={(e) => fetchWithdrawals(e.target.value || null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {withdrawals.length > 0 ? (
                <div className="space-y-4">
                  {withdrawals.map((withdrawal) => (
                    <div key={withdrawal.id} className="border border-gray-200 rounded-lg p-6 bg-white">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-lg">{withdrawal.sellers?.business_name || 'Seller'}</h3>
                          <p className="text-sm text-gray-500">{withdrawal.sellers?.users?.email}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          withdrawal.status === 'completed' ? 'bg-green-100 text-green-800' :
                          withdrawal.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          withdrawal.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {withdrawal.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-gray-500">Amount</p>
                          <p className="font-semibold text-lg">₹{withdrawal.amount?.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Account</p>
                          <p className="font-mono text-sm">{withdrawal.bank_account_number}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">IFSC</p>
                          <p className="font-mono text-sm">{withdrawal.ifsc_code}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Requested</p>
                          <p className="text-sm">{new Date(withdrawal.requested_at).toLocaleDateString()}</p>
                        </div>
                      </div>

                      {withdrawal.manual_transaction_id && (
                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-xs text-blue-700">Manual Transaction ID / UTR</p>
                          <p className="font-mono text-sm font-semibold text-blue-900 mt-1">{withdrawal.manual_transaction_id}</p>
                        </div>
                      )}

                      {withdrawal.status === 'pending' && (
                        <div className="flex space-x-3">
                          <button
                            onClick={() => handleApproveWithdrawal(withdrawal.id)}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2"
                          >
                            <CheckCircle className="w-5 h-5" />
                            <span>Approve & Mark Paid</span>
                          </button>
                          <button
                            onClick={() => {
                              const reason = prompt('Rejection reason:')
                              if (reason) handleRejectWithdrawal(withdrawal.id, reason)
                            }}
                            className="px-6 py-2 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg font-semibold transition-colors flex items-center space-x-2"
                          >
                            <XCircle className="w-5 h-5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      )}

                      {withdrawal.failure_reason && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
                          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-red-800">{withdrawal.failure_reason}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Wallet className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p>No withdrawal requests found</p>
                </div>
              )}
            </div>
          )}

          {/* Earnings Tab */}
          {activeTab === 'earnings' && (
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold">Platform Revenue</h2>
                  <p className="text-sm text-gray-600">2.5% Seller Commission + Platform Fees (₹10/₹20) + Delivery Fees (includes ₹10 markup on Shiprocket rate)</p>
                </div>
                <select
                  onChange={(e) => fetchEarnings(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="year">This Year</option>
                  <option value="all">All Time</option>
                </select>
              </div>

              {earnings ? (
                <>
                  {/* Earnings Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
                      <div className="flex items-center justify-between mb-2">
                        <DollarSign className="w-8 h-8" />
                        <TrendingUp className="w-6 h-6" />
                      </div>
                      <p className="text-purple-100 text-sm mb-1">Total Revenue</p>
                      <p className="text-3xl font-bold">₹{earnings.totalRevenue?.toLocaleString() || '0.00'}</p>
                    </div>

                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
                      <div className="flex items-center justify-between mb-2">
                        <DollarSign className="w-8 h-8" />
                      </div>
                      <p className="text-green-100 text-sm mb-1">Seller Commission (2.5%)</p>
                      <p className="text-3xl font-bold">₹{earnings.totalCommission?.toLocaleString() || '0.00'}</p>
                    </div>
                    
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
                      <div className="flex items-center justify-between mb-2">
                        <Package className="w-8 h-8" />
                      </div>
                      <p className="text-blue-100 text-sm mb-1">Platform Fees</p>
                      <p className="text-3xl font-bold">₹{earnings.totalPlatformFees?.toLocaleString() || '0.00'}</p>
                    </div>

                    <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white">
                      <div className="flex items-center justify-between mb-2">
                        <Package className="w-8 h-8" />
                      </div>
                      <p className="text-orange-100 text-sm mb-1">Delivery Fees</p>
                      <p className="text-3xl font-bold">₹{earnings.totalDeliveryFees?.toLocaleString() || '0.00'}</p>
                    </div>

                  </div>

                  {/* Recent Earnings - Detailed Table */}
                  {earnings.recentEarnings && earnings.recentEarnings.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Recent Revenue Breakdown</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b-2 border-gray-200">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Order</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Seller</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Commission (2.5%)</th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Platform Fee</th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Delivery Fee</th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {earnings.recentEarnings.map((earning) => {
                              const commission = parseFloat(earning.commission_amount || 0)
                              const platformFee = parseFloat(earning.platform_fee || 0)
                              const deliveryFee = parseFloat(earning.delivery_fee || 0)
                              const total = commission + platformFee + deliveryFee

                              return (
                                <tr key={earning.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                    #{earning.order_id?.slice(0, 8)}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-600">
                                    {earning.sellers?.business_name || 'N/A'}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-600">
                                    {new Date(earning.earned_at).toLocaleDateString('en-IN', {
                                      day: 'numeric',
                                      month: 'short'
                                    })}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
                                    ₹{commission.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right font-semibold text-blue-600">
                                    {platformFee > 0 ? `₹${platformFee}` : '-'}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right font-semibold text-orange-600">
                                    {deliveryFee > 0 ? `₹${deliveryFee}` : '-'}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right font-bold text-purple-600">
                                    ₹{total.toLocaleString()}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                          <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                            <tr>
                              <td colSpan="3" className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                                Total:
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-bold text-green-600">
                                ₹{earnings.totalCommission?.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-bold text-blue-600">
                                ₹{earnings.totalPlatformFees?.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-bold text-orange-600">
                                ₹{earnings.totalDeliveryFees?.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right text-lg font-bold text-purple-600">
                                ₹{earnings.totalRevenue?.toLocaleString()}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <DollarSign className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p>No earnings data available</p>
                </div>
              )}
            </div>
          )}

          {/* Support Tickets Tab */}
          {activeTab === 'support' && (
            <div className="p-6">
              <AdminSupportPage />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

