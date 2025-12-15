'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Users, 
  Package, 
  ShoppingBag,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  DollarSign
} from 'lucide-react'
import { apiService } from '../services/api'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

export const AdminDashboardPage = () => {
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
  const router = useRouter()

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)
      
      // Fetch sellers (admin endpoint)
      const sellers = await apiService.getSellersForAdmin()
      const pendingSellers = sellers.filter(s => !s.users?.is_approved).length
      const approvedSellers = sellers.filter(s => s.users?.is_approved).length

      // Fetch products
      const products = await apiService.getProducts({ admin: true })
      const pendingProducts = products.filter(p => p.status === 'pending').length
      const approvedProducts = products.filter(p => p.status === 'approved').length

      // Fetch orders (if API exists)
      let totalOrders = 0
      let totalRevenue = 0
      try {
        const orders = await apiService.getOrders({ userType: 'admin' })
        totalOrders = orders.length
        totalRevenue = orders.reduce((sum, order) => sum + (parseFloat(order.total_amount) || 0), 0)
      } catch (err) {
        console.log('Orders API not available:', err)
      }

      setStats({
        totalSellers: sellers.length,
        pendingSellers,
        approvedSellers,
        totalProducts: products.length,
        pendingProducts,
        approvedProducts,
        totalOrders,
        totalRevenue
      })
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
      toast.error('Failed to load dashboard statistics')
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      title: 'Total Sellers',
      value: stats.totalSellers,
      icon: Users,
      color: 'blue',
      link: '/admin/sellers'
    },
    {
      title: 'Pending Sellers',
      value: stats.pendingSellers,
      icon: Clock,
      color: 'yellow',
      link: '/admin/sellers?status=pending'
    },
    {
      title: 'Total Products',
      value: stats.totalProducts,
      icon: Package,
      color: 'green',
      link: '/admin/products'
    },
    {
      title: 'Pending Products',
      value: stats.pendingProducts,
      icon: AlertCircle,
      color: 'orange',
      link: '/admin/products?status=pending'
    },
    {
      title: 'Total Orders',
      value: stats.totalOrders,
      icon: ShoppingBag,
      color: 'purple',
      link: '/orders?userType=admin'
    },
    {
      title: 'Total Revenue',
      value: `₹${stats.totalRevenue.toLocaleString('en-IN')}`,
      icon: DollarSign,
      color: 'green',
      link: '/orders?userType=admin'
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
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="mt-2 text-gray-600">Manage sellers, products, and monitor platform activity</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
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
                  className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
              </div>
                    <div className={`p-3 rounded-lg ${colorClasses[stat.color]}`}>
                      <Icon className="w-6 h-6" />
              </div>
            </div>
          </motion.div>
              </Link>
            )
          })}
          </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link href="/admin/sellers?status=pending">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-yellow-50 hover:bg-yellow-100 text-yellow-700 py-4 px-6 rounded-xl font-semibold transition-colors flex items-center justify-center space-x-2"
              >
                <Clock className="w-5 h-5" />
                <span>Review Pending Sellers</span>
              </motion.button>
            </Link>
            <Link href="/admin/products?status=pending">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-orange-50 hover:bg-orange-100 text-orange-700 py-4 px-6 rounded-xl font-semibold transition-colors flex items-center justify-center space-x-2"
              >
                <AlertCircle className="w-5 h-5" />
                <span>Review Pending Products</span>
              </motion.button>
            </Link>
            <Link href="/admin/sellers">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 py-4 px-6 rounded-xl font-semibold transition-colors flex items-center justify-center space-x-2"
              >
                <Users className="w-5 h-5" />
                <span>Manage All Sellers</span>
              </motion.button>
            </Link>
                        </div>
                      </div>

        {/* Recent Activity Summary */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Platform Overview</h2>
                        <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium text-gray-900">Approved Sellers</span>
                              </div>
              <span className="text-2xl font-bold text-gray-900">{stats.approvedSellers}</span>
                              </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Clock className="w-5 h-5 text-yellow-600" />
                <span className="font-medium text-gray-900">Pending Seller Approvals</span>
                            </div>
              <span className="text-2xl font-bold text-gray-900">{stats.pendingSellers}</span>
                          </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                                         <div className="flex items-center space-x-3">
                <Package className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-gray-900">Total Products</span>
                                 </div>
              <span className="text-2xl font-bold text-gray-900">{stats.totalProducts}</span>
                            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                  <div className="flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                <span className="font-medium text-gray-900">Pending Product Approvals</span>
                                  </div>
              <span className="text-2xl font-bold text-gray-900">{stats.pendingProducts}</span>
                                </div>
                                  </div>
                                  </div>
                                  </div>
                                </div>
    )
  } 

