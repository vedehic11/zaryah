'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Package, ShoppingCart, TrendingUp, DollarSign, Eye, Edit, Trash2,
  Plus, Clock, CheckCircle, XCircle, AlertTriangle, Users, Star,
  BarChart3, Settings, Upload, Image as ImageIcon, FileText, MessageCircle,
  Wallet, ArrowUpCircle, ArrowDownCircle, CreditCard, IndianRupee, Truck, ExternalLink, User,
  Instagram, Facebook, Twitter, Linkedin, MapPin, Building, Sparkles
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { apiService } from '../services/api'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function SellerDashboardPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('products')
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalRevenue: 0
  })
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [tickets, setTickets] = useState([])
  
  // Wallet state
  const [wallet, setWallet] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [withdrawals, setWithdrawals] = useState([])
  const [showWithdrawalForm, setShowWithdrawalForm] = useState(false)
  const [withdrawalData, setWithdrawalData] = useState({
    amount: '',
    bank_account_number: '',
    ifsc_code: '',
    account_holder_name: ''
  })
  
  // Profile settings state
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadingProfile, setUploadingProfile] = useState(false)
  const [profileData, setProfileData] = useState({
    business_name: '',
    username: '',
    full_name: '',
    business_address: '',
    city: '',
    state: '',
    pincode: '',
    primary_mobile: '',
    cover_photo: '',
    profile_photo: '',
    business_description: '',
    story: '',
    instagram: '',
    facebook: '',
    x: '',
    linkedin: '',
    account_holder_name: '',
    account_number: '',
    ifsc_code: '',
    id_type: '',
    id_number: ''
  })

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
      return
    }

    if (user && user.role !== 'seller') {
      toast.error('Access denied. Seller account required.')
      router.push('/')
      return
    }

    if (user && user.role === 'seller') {
      fetchDashboardData()
    }
  }, [user?.id, user?.role, authLoading]) // Only depend on user ID and role, not full user object

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Fetch all data in parallel for better performance
      const [productsData, ordersData, walletData] = await Promise.allSettled([
        apiService.getProducts({ sellerId: user.id }),
        apiService.getOrders('seller').catch(() => []),
        apiService.getWallet().catch(() => ({ wallet: null, transactions: [], withdrawals: [] }))
      ])

      // Fetch seller profile for profile tab
      fetchSellerProfile()

      // Process products
      const products = productsData.status === 'fulfilled' ? productsData.value || [] : []
      setProducts(products)

      // Process orders
      const orders = ordersData.status === 'fulfilled' ? ordersData.value || [] : []
      setOrders(orders)
        
      // Calculate stats using the fetched orders
      const pendingCount = orders.filter(o => 
        o.status === 'pending' || o.status === 'confirmed' || o.status === 'dispatched'
      ).length
      const completedCount = orders.filter(o => o.status === 'delivered').length
      
      // Calculate revenue from delivered orders only (95% after 5% commission)
      const totalRevenue = orders
        .filter(o => o.status === 'delivered')
        .reduce((sum, order) => {
          const orderTotal = parseFloat(order.total_amount) || 0
          const sellerShare = orderTotal * 0.95 // 95% to seller, 5% platform fee
          return sum + sellerShare
        }, 0)

      setStats({
        totalProducts: products.length,
        totalOrders: orders.length,
        pendingOrders: pendingCount,
        completedOrders: completedCount,
        totalRevenue: totalRevenue
      })

      // Process wallet data
      const wallet = walletData.status === 'fulfilled' ? walletData.value : { wallet: null, transactions: [], withdrawals: [] }
      setWallet(wallet.wallet || null)
      setTransactions(wallet.transactions || [])
      setWithdrawals(wallet.withdrawals || [])

      // Skip support tickets for now (causing errors)
      setTickets([])

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }
  
  const fetchSellerProfile = async () => {
    try {
      const response = await apiService.request(`/sellers?seller_id=${user.id}`)
      console.log('Seller profile response:', response)
      if (response) {
        setProfileData({
          business_name: response.business_name || '',
          username: response.username || '',
          full_name: response.full_name || '',
          business_address: response.business_address || '',
          city: response.city || '',
          state: response.state || '',
          pincode: response.pincode || '',
          primary_mobile: response.primary_mobile || '',
          cover_photo: response.cover_photo || '',
          profile_photo: response.users?.profile_photo || user?.profilePhoto || '',
          business_description: response.business_description || '',
          story: response.story || '',
          instagram: response.instagram || '',
          facebook: response.facebook || '',
          x: response.x || '',
          linkedin: response.linkedin || '',
          account_holder_name: response.account_holder_name || '',
          account_number: response.account_number || '',
          ifsc_code: response.ifsc_code || '',
          id_type: response.id_type || '',
          id_number: response.id_number || ''
        })
        console.log('Profile data set:', profileData)
      }
    } catch (error) {
      console.error('Error fetching seller profile:', error)
    }
  }
  
  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Check file type - support images and videos
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload an image (JPEG, PNG, WebP) or video (MP4, WebM)')
      return
    }
    
    // Check file size (max 10MB for images, 50MB for videos)
    const maxSize = file.type.startsWith('video/') ? 50 * 1024 * 1024 : 10 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error(`File too large. Maximum size is ${file.type.startsWith('video/') ? '50MB' : '10MB'}`)
      return
    }
    
    try {
      setUploadingCover(true)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'seller-covers')
      formData.append('useSupabase', 'false') // Use Cloudinary for cover photos/videos
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }
      
      const data = await response.json()
      
      // Update seller profile with new cover photo URL
      await apiService.request(`/sellers`, {
        method: 'PUT',
        body: JSON.stringify({ cover_photo: data.url })
      })
      
      setProfileData(prev => ({ ...prev, cover_photo: data.url }))
      toast.success('Cover photo updated successfully!')
      fetchDashboardData()
    } catch (error) {
      console.error('Error uploading cover:', error)
      toast.error(error.message || 'Failed to upload cover photo')
    } finally {
      setUploadingCover(false)
    }
  }
  
  const handleProfilePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload an image (JPEG, PNG, WebP)')
      return
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 5MB')
      return
    }
    
    try {
      setUploadingProfile(true)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'profile-photos')
      formData.append('useSupabase', 'false')
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }
      
      const data = await response.json()
      
      // Update user profile photo in users table via API
      await apiService.request(`/sellers`, {
        method: 'PUT',
        body: JSON.stringify({ profile_photo: data.url })
      })
      
      toast.success('Profile photo updated successfully!')
      fetchDashboardData()
    } catch (error) {
      console.error('Error uploading profile photo:', error)
      toast.error(error.message || 'Failed to upload profile photo')
    } finally {
      setUploadingProfile(false)
    }
  }
  
  const handleUpdateProfile = async () => {
    try {
      await apiService.request(`/sellers`, {
        method: 'PUT',
        body: JSON.stringify({
          business_description: profileData.business_description,
          story: profileData.story,
          instagram: profileData.instagram,
          facebook: profileData.facebook,
          x: profileData.x,
          linkedin: profileData.linkedin
        })
      })
      
      toast.success('Profile updated successfully!')
      setShowEditProfile(false)
      fetchDashboardData()
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error(error.message || 'Failed to update profile')
    }
  }

  const handleDeleteProduct = async (productId) => {
    if (!confirm('Are you sure you want to delete this product?')) return

    try {
      await apiService.deleteProduct(productId)
      toast.success('Product deleted successfully')
      fetchDashboardData()
    } catch (error) {
      toast.error('Failed to delete product')
    }
  }

  // Check if seller is approved
  if (!authLoading && user && !user.isApproved) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center"
        >
          <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Approval Pending
          </h2>
          <p className="text-gray-600 mb-6">
            Your seller account is currently under review by our admin team. 
            You'll receive an email notification once your account is approved.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>What happens next?</strong><br />
              Our team is reviewing your business details and documents. 
              This usually takes 24-48 hours. Once approved, you'll be able to add products and start selling!
            </p>
          </div>
          <Link
            href="/"
            className="inline-block bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
          >
            Go to Homepage
          </Link>
        </motion.div>
      </div>
    )
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  // Stats Cards
  const statsCards = [
    {
      title: 'Total Products',
      value: stats.totalProducts,
      icon: Package,
      color: 'blue',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-600'
    },
    {
      title: 'Total Orders',
      value: stats.totalOrders,
      icon: ShoppingCart,
      color: 'green',
      bgColor: 'bg-green-100',
      textColor: 'text-green-600'
    },
    {
      title: 'Pending Orders',
      value: stats.pendingOrders,
      icon: Clock,
      color: 'orange',
      bgColor: 'bg-orange-100',
      textColor: 'text-orange-600'
    },
    {
      title: 'Completed Orders',
      value: stats.completedOrders,
      icon: CheckCircle,
      color: 'emerald',
      bgColor: 'bg-emerald-100',
      textColor: 'text-emerald-600'
    },
    {
      title: 'Revenue',
      value: `₹${stats.totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: 'purple',
      bgColor: 'bg-purple-100',
      textColor: 'text-purple-600'
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Add Product Button Only */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-end">
            <Link
              href="/seller/products/new"
              className="inline-flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Add Product</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6 mb-8">
          {statsCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-xs sm:text-sm font-medium">{stat.title}</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1 sm:mt-2">{stat.value}</p>
                </div>
                <div className={`${stat.bgColor} rounded-full p-2 sm:p-3`}>
                  <stat.icon className={`w-4 h-4 sm:w-6 sm:h-6 ${stat.textColor}`} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="border-b border-gray-200 overflow-x-auto">
            <nav className="flex space-x-4 sm:space-x-8 px-4 sm:px-6 min-w-max" aria-label="Tabs">
              {['products', 'orders', 'wallet', 'support', 'profile'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm capitalize transition-colors whitespace-nowrap ${
                    activeTab === tab
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-3 sm:p-6">
            {/* Products Tab */}
            {activeTab === 'products' && (
              <div>
                <div className="flex items-center justify-end mb-6">
                  <Link
                    href="/seller/products/new"
                    className="inline-flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Product</span>
                  </Link>
                </div>

                {products.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">No products yet</p>
                    <Link
                      href="/seller/products/new"
                      className="inline-flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                      <span>Add Your First Product</span>
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.map((product) => (
                      <div key={product.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                        <div className="aspect-square bg-gray-100 relative">
                          {product.images && product.images.length > 0 ? (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-12 h-12 text-gray-400" />
                            </div>
                          )}
                          <span className={`absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded-full ${
                            product.status === 'approved' ? 'bg-green-100 text-green-700' :
                            product.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {product.status}
                          </span>
                        </div>
                        <div className="p-4">
                          <h4 className="font-semibold text-gray-900 mb-1">{product.name}</h4>
                          <div className="flex items-center space-x-2 mb-2">
                            <p className="text-gray-900 text-sm font-bold">₹{product.price}</p>
                            {product.mrp && product.mrp > product.price && (
                              <>
                                <p className="text-gray-500 text-xs line-through">₹{product.mrp}</p>
                                <span className="text-xs font-semibold text-orange-500">
                                  {Math.round(((product.mrp - product.price) / product.mrp) * 100)}% OFF
                                </span>
                              </>
                            )}
                          </div>
                          <p className="text-gray-500 text-xs mb-3">Stock: {product.stock}</p>
                          <div className="flex items-center space-x-2">
                            <Link
                              href={`/product/${product.id}`}
                              className="flex-1 inline-flex items-center justify-center space-x-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                              <span>View</span>
                            </Link>
                            <Link
                              href={`/seller/products/${product.id}/edit`}
                              className="flex-1 inline-flex items-center justify-center space-x-1 bg-primary-100 hover:bg-primary-200 text-primary-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                              <span>Edit</span>
                            </Link>
                            <button
                              onClick={() => handleDeleteProduct(product.id)}
                              className="inline-flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <div>
                {orders.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <ShoppingCart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No orders yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => {
                      const buyer = order.buyers
                      const orderItemsArray = order.order_items || []
                      
                      return (
                        <div key={order.id} className="bg-white border border-gray-200 rounded-lg p-3 sm:p-6 hover:shadow-lg transition-shadow">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h4 className="font-semibold text-sm sm:text-base text-gray-900">Order #{order.id.slice(0, 8)}</h4>
                              <p className="text-xs sm:text-sm text-gray-600">{new Date(order.created_at).toLocaleString()}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                              order.status === 'dispatched' ? 'bg-blue-100 text-blue-700' :
                              order.status === 'confirmed' ? 'bg-indigo-100 text-indigo-700' :
                              order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </span>
                          </div>
                          
                          {/* Buyer Information */}
                          <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-gray-50 rounded-lg">
                            <h5 className="font-semibold text-sm sm:text-base text-gray-900 mb-2">Buyer Information</h5>
                            <div className="space-y-1 text-xs sm:text-sm">
                              <p className="text-gray-700">
                                <span className="font-medium">Address:</span> {order.address || 'N/A'}
                              </p>
                              {buyer && (
                                <>
                                  <p className="text-gray-700">
                                    <span className="font-medium">City:</span> {buyer.city || 'N/A'}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                          
                          {/* Order Items */}
                          <div className="mb-3 sm:mb-4">
                            <h5 className="font-semibold text-sm sm:text-base text-gray-900 mb-2">Items</h5>
                            <div className="space-y-2 sm:space-y-3">
                              {orderItemsArray.map((item, idx) => (
                                <div key={idx} className="bg-gray-50 p-2 sm:p-3 rounded-lg">
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs sm:text-sm text-gray-700 font-medium">
                                          {item.products?.name || 'Product'} x {item.quantity}
                                        </span>
                                        <span className="font-medium text-sm sm:text-base text-gray-900">₹{(parseFloat(item.price) * item.quantity).toFixed(2)}</span>
                                      </div>
                                      
                                      {/* Gift Packaging */}
                                      {item.gift_packaging && (
                                        <div className="flex items-center mt-1">
                                          <Package className="w-3 h-3 text-purple-600 mr-1" />
                                          <span className="text-xs text-purple-600 font-medium">Gift Packaging (+₹50)</span>
                                        </div>
                                      )}
                                      
                                      {/* Customizations */}
                                      {item.customizations && Array.isArray(item.customizations) && item.customizations.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                          <p className="text-xs font-semibold text-gray-700">Customer Requests:</p>
                                          {item.customizations.map((custom, customIdx) => (
                                            <div key={customIdx} className="text-xs text-gray-600 pl-3 border-l-2 border-blue-400">
                                              <span className="font-medium">{custom.question}:</span> <span className="text-gray-800">{custom.answer}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Shipment Tracking (if available) */}
                          {(order.awb_code || order.courier_name || order.tracking_url) && (
                            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                              <h5 className="font-semibold text-blue-900 mb-2 flex items-center">
                                <Truck className="w-4 h-4 mr-2" />
                                Shipment Details
                              </h5>
                              <div className="space-y-1 text-sm">
                                {order.courier_name && (
                                  <p className="text-gray-700">
                                    <span className="font-medium">Courier:</span> {order.courier_name}
                                  </p>
                                )}
                                {order.awb_code && (
                                  <p className="text-gray-700">
                                    <span className="font-medium">AWB Code:</span> {order.awb_code}
                                  </p>
                                )}
                                {order.tracking_url && (
                                  <a
                                    href={order.tracking_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
                                  >
                                    <ExternalLink className="w-3 h-3 mr-1" />
                                    Track Shipment
                                  </a>
                                )}
                                {order.shipment_status && (
                                  <p className="text-gray-700">
                                    <span className="font-medium">Shipment Status:</span> {order.shipment_status}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Payment & Total */}
                          <div className="border-t border-gray-200 pt-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-gray-600">Payment Method</span>
                              <span className="font-medium text-gray-900">{order.payment_method.toUpperCase()}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600 font-semibold">Total Amount</span>
                              <span className="font-bold text-gray-900 text-lg">₹{parseFloat(order.total_amount).toFixed(2)}</span>
                            </div>
                          </div>
                          
                          {/* Action Buttons */}
                          {order.status === 'pending' && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <button
                                onClick={async () => {
                                  try {
                                    await apiService.request(`/orders/${order.id}`, {
                                      method: 'PUT',
                                      body: JSON.stringify({ status: 'confirmed' })
                                    })
                                    
                                    toast.success('Order confirmed successfully')
                                    fetchDashboardData() // Refresh orders
                                  } catch (error) {
                                    console.error('Error confirming order:', error)
                                    toast.error(error.message || 'Failed to confirm order')
                                  }
                                }}
                                className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2"
                              >
                                <CheckCircle className="w-5 h-5" />
                                <span>Confirm Order</span>
                              </button>
                            </div>
                          )}
                          
                          {order.status === 'confirmed' && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <button
                                onClick={async () => {
                                  try {
                                    await apiService.request(`/orders/${order.id}`, {
                                      method: 'PUT',
                                      body: JSON.stringify({ status: 'dispatched' })
                                    })
                                    
                                    toast.success('Order marked as dispatched')
                                    fetchDashboardData()
                                  } catch (error) {
                                    console.error('Error updating order:', error)
                                    toast.error(error.message || 'Failed to update order')
                                  }
                                }}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2"
                              >
                                <Package className="w-5 h-5" />
                                <span>Mark as Dispatched</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Support Tab */}
            {activeTab === 'support' && (
              <div className="space-y-8">
                {tickets.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No customer tickets yet</p>
                    <p className="text-sm text-gray-500 mt-2">Customer queries and support requests will appear here</p>
                  </div>
                ) : (
                  <>
                    {/* Live Tickets Section */}
                    <div>
                      <div className="flex items-center space-x-3 mb-4">
                        <h4 className="text-md font-semibold text-gray-900">Live Tickets</h4>
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-cyan-100 text-cyan-700">
                          {tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length}
                        </span>
                      </div>
                      {tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length === 0 ? (
                        <div className="text-center py-8 bg-cyan-50 rounded-lg border border-cyan-100">
                          <MessageCircle className="w-10 h-10 text-cyan-400 mx-auto mb-3" />
                          <p className="text-cyan-700 text-sm">No live tickets at the moment</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {tickets
                            .filter(t => t.status === 'open' || t.status === 'in_progress')
                            .map((ticket) => (
                              <div key={ticket.id} className="bg-white border border-cyan-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between mb-4">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-3 mb-2">
                                      <h4 className="font-semibold text-gray-900">{ticket.subject || 'Support Query'}</h4>
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        ticket.status === 'open' ? 'bg-green-100 text-green-700' :
                                        'bg-blue-100 text-blue-700'
                                      }`}>
                                        {ticket.status}
                                      </span>
                                      {ticket.priority && (
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                          ticket.priority === 'high' ? 'bg-red-100 text-red-700' :
                                          ticket.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                          'bg-gray-100 text-gray-700'
                                        }`}>
                                          {ticket.priority} priority
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-600 mb-3">
                                      From: <span className="font-medium">{ticket.buyer_name || ticket.buyer_email || 'Customer'}</span>
                                    </p>
                                    <p className="text-gray-700 mb-3">{ticket.message || ticket.description}</p>
                                    {ticket.order_id && (
                                      <p className="text-sm text-gray-500">
                                        Related to Order #{ticket.order_id.slice(0, 8)}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right ml-4">
                                    <p className="text-xs text-gray-500 mb-2">{new Date(ticket.created_at).toLocaleDateString()}</p>
                                    <p className="text-xs text-gray-400">{new Date(ticket.created_at).toLocaleTimeString()}</p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2 pt-4 border-t border-gray-200">
                                  <button className="inline-flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                                    <MessageCircle className="w-4 h-4" />
                                    <span>Reply</span>
                                  </button>
                                  <button className="inline-flex items-center space-x-2 bg-green-100 hover:bg-green-200 text-green-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Mark Resolved</span>
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* Resolved Tickets Section */}
                    <div>
                      <div className="flex items-center space-x-3 mb-4">
                        <h4 className="text-md font-semibold text-gray-900">Resolved Tickets</h4>
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                          {tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length}
                        </span>
                      </div>
                      {tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length === 0 ? (
                        <div className="text-center py-8 bg-green-50 rounded-lg border border-green-100">
                          <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
                          <p className="text-green-700 text-sm">No resolved tickets yet</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {tickets
                            .filter(t => t.status === 'resolved' || t.status === 'closed')
                            .map((ticket) => (
                              <div key={ticket.id} className="bg-white border border-green-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between mb-4">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-3 mb-2">
                                      <h4 className="font-semibold text-gray-900">{ticket.subject || 'Support Query'}</h4>
                                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                        resolved
                                      </span>
                                      {ticket.priority && (
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                          ticket.priority === 'high' ? 'bg-red-100 text-red-700' :
                                          ticket.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                          'bg-gray-100 text-gray-700'
                                        }`}>
                                          {ticket.priority} priority
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-600 mb-3">
                                      From: <span className="font-medium">{ticket.buyer_name || ticket.buyer_email || 'Customer'}</span>
                                    </p>
                                    <p className="text-gray-700 mb-3">{ticket.message || ticket.description}</p>
                                    {ticket.order_id && (
                                      <p className="text-sm text-gray-500">
                                        Related to Order #{ticket.order_id.slice(0, 8)}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right ml-4">
                                    <p className="text-xs text-gray-500 mb-2">{new Date(ticket.created_at).toLocaleDateString()}</p>
                                    <p className="text-xs text-gray-400">{new Date(ticket.created_at).toLocaleTimeString()}</p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2 pt-4 border-t border-gray-200">
                                  <button className="inline-flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                                    <MessageCircle className="w-4 h-4" />
                                    <span>View Thread</span>
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Wallet Tab */}
            {activeTab === 'wallet' && (
              <div className="p-6 space-y-6">
                {/* Wallet Balance Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Available Balance */}
                  <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-6 text-white shadow-lg border border-primary-300">
                    <div className="flex items-center justify-between mb-4">
                      <Wallet className="w-8 h-8" />
                      <CheckCircle className="w-6 h-6" />
                    </div>
                    <p className="text-primary-100 text-sm font-medium mb-1">Available Balance</p>
                    <p className="text-3xl font-bold">₹{wallet?.available_balance?.toLocaleString() || '0.00'}</p>
                    <p className="text-primary-100 text-xs mt-2">Ready to withdraw</p>
                  </div>

                  {/* Pending Balance */}
                  <div className="bg-gradient-to-br from-secondary-400 to-secondary-500 rounded-xl p-6 text-white shadow-lg border border-secondary-300">
                    <div className="flex items-center justify-between mb-4">
                      <Clock className="w-8 h-8" />
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <p className="text-secondary-50 text-sm font-medium mb-1">Pending Balance</p>
                    <p className="text-3xl font-bold">₹{wallet?.pending_balance?.toLocaleString() || '0.00'}</p>
                    <p className="text-secondary-50 text-xs mt-2">Awaiting order delivery</p>
                  </div>

                  {/* Total Earned */}
                  <div className="bg-gradient-to-br from-charcoal-700 to-charcoal-800 rounded-xl p-6 text-white shadow-lg border border-charcoal-600">
                    <div className="flex items-center justify-between mb-4">
                      <TrendingUp className="w-8 h-8" />
                      <Star className="w-6 h-6" />
                    </div>
                    <p className="text-charcoal-200 text-sm font-medium mb-1">Total Earned</p>
                    <p className="text-3xl font-bold">₹{wallet?.total_earned?.toLocaleString() || '0.00'}</p>
                    <p className="text-charcoal-200 text-xs mt-2">Lifetime earnings (95% after commission)</p>
                  </div>
                </div>

                {/* Withdrawal Button */}
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowWithdrawalForm(!showWithdrawalForm)}
                    disabled={!wallet || parseFloat(wallet.available_balance) < 500}
                    className="inline-flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-semibold transition-colors"
                  >
                    <ArrowUpCircle className="w-5 h-5" />
                    <span>{showWithdrawalForm ? 'Cancel' : 'Request Withdrawal'}</span>
                  </button>
                </div>

                {/* Withdrawal Form */}
                {showWithdrawalForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-gray-50 rounded-xl p-6"
                  >
                    <h3 className="text-lg font-semibold mb-4">Withdrawal Request</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Amount (Min ₹500)</label>
                        <div className="relative">
                          <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="number"
                            value={withdrawalData.amount}
                            onChange={(e) => setWithdrawalData({...withdrawalData, amount: e.target.value})}
                            min="500"
                            max={wallet?.available_balance || 0}
                            className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            placeholder="Enter amount"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Account Holder Name</label>
                        <input
                          type="text"
                          value={withdrawalData.account_holder_name}
                          onChange={(e) => setWithdrawalData({...withdrawalData, account_holder_name: e.target.value})}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                          placeholder="As per bank records"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Bank Account Number</label>
                        <input
                          type="text"
                          value={withdrawalData.bank_account_number}
                          onChange={(e) => setWithdrawalData({...withdrawalData, bank_account_number: e.target.value})}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                          placeholder="Enter account number"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">IFSC Code</label>
                        <input
                          type="text"
                          value={withdrawalData.ifsc_code}
                          onChange={(e) => setWithdrawalData({...withdrawalData, ifsc_code: e.target.value.toUpperCase()})}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                          placeholder="e.g., SBIN0001234"
                        />
                      </div>

                      <div className="flex space-x-3 pt-4">
                        <button
                          onClick={async () => {
                            try {
                              const amount = parseFloat(withdrawalData.amount)
                              if (amount < 500) {
                                toast.error('Minimum withdrawal amount is ₹500')
                                return
                              }
                              if (amount > parseFloat(wallet?.available_balance || 0)) {
                                toast.error('Insufficient available balance')
                                return
                              }
                              if (!withdrawalData.account_holder_name || !withdrawalData.bank_account_number || !withdrawalData.ifsc_code) {
                                toast.error('Please fill all bank details')
                                return
                              }

                              await apiService.requestWithdrawal(withdrawalData)
                              toast.success('Withdrawal request submitted! Admin will review shortly.')
                              setShowWithdrawalForm(false)
                              setWithdrawalData({ amount: '', bank_account_number: '', ifsc_code: '', account_holder_name: '' })
                              // Refresh wallet data
                              const walletData = await apiService.getWallet()
                              setWallet(walletData.wallet)
                              setWithdrawals(walletData.withdrawals || [])
                            } catch (error) {
                              toast.error(error.message || 'Failed to submit withdrawal request')
                            }
                          }}
                          className="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                        >
                          Submit Request
                        </button>
                        <button
                          onClick={() => setShowWithdrawalForm(false)}
                          className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Withdrawal Requests */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Withdrawal History</h3>
                  <div className="space-y-3">
                    {withdrawals && withdrawals.length > 0 ? (
                      withdrawals.map((withdrawal) => (
                        <div key={withdrawal.id} className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-gray-900">₹{withdrawal.amount?.toLocaleString()}</p>
                              <p className="text-sm text-gray-500">{new Date(withdrawal.requested_at).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                withdrawal.status === 'completed' ? 'bg-green-100 text-green-800' :
                                withdrawal.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                withdrawal.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {withdrawal.status}
                              </span>
                              {withdrawal.failure_reason && (
                                <p className="text-xs text-red-600 mt-1">{withdrawal.failure_reason}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p>No withdrawal requests yet</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Transaction History */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Transaction History</h3>
                  <div className="space-y-2">
                    {transactions && transactions.length > 0 ? (
                      transactions.map((txn) => (
                        <div key={txn.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-full ${
                              txn.type.includes('credit') ? 'bg-green-100' : 'bg-red-100'
                            }`}>
                              {txn.type.includes('credit') ? (
                                <ArrowDownCircle className={`w-5 h-5 ${txn.type.includes('credit') ? 'text-green-600' : 'text-red-600'}`} />
                              ) : (
                                <ArrowUpCircle className="w-5 h-5 text-red-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{txn.description || txn.type.replace(/_/g, ' ')}</p>
                              <p className="text-sm text-gray-500">{new Date(txn.created_at).toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-semibold ${txn.type.includes('credit') ? 'text-green-600' : 'text-red-600'}`}>
                              {txn.type.includes('credit') ? '+' : '-'}₹{Math.abs(txn.amount).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500 capitalize">{txn.status}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p>No transactions yet</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                {!showEditProfile ? (
                  <div className="space-y-6">
                    {/* Profile & Cover Photos */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      {/* Cover Photo */}
                      <div className="relative h-48 bg-gradient-to-br from-primary-500 to-secondary-500">
                        {profileData?.cover_photo ? (
                          profileData.cover_photo.includes('.mp4') || profileData.cover_photo.includes('.webm') ? (
                            <video
                              src={profileData.cover_photo}
                              className="w-full h-full object-cover"
                              autoPlay
                              loop
                              muted
                            />
                          ) : (
                            <img
                              src={profileData.cover_photo}
                              alt="Cover"
                              className="w-full h-full object-cover"
                            />
                          )
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-16 h-16 text-white/50" />
                          </div>
                        )}
                      </div>
                      {/* Profile Photo */}
                      <div className="relative px-6 pb-6">
                        <div className="flex items-end justify-between -mt-16">
                          <div className="relative">
                            {profileData?.profile_photo ? (
                              <img
                                src={profileData.profile_photo}
                                alt={profileData?.business_name || 'Profile'}
                                className="w-32 h-32 rounded-full border-4 border-white shadow-xl object-cover"
                              />
                            ) : (
                              <div className="w-32 h-32 rounded-full border-4 border-white shadow-xl bg-gray-200 flex items-center justify-center">
                                <User className="w-16 h-16 text-gray-400" />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="mt-4">
                          <h2 className="text-2xl font-bold text-gray-900">{profileData?.business_name || 'Business Name'}</h2>
                          <p className="text-gray-600">@{profileData?.username || 'username'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Business Information */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Building className="w-5 h-5 text-primary-600" />
                        Business Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
                          <p className="text-gray-900">{profileData?.business_name || 'Not set'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                          <p className="text-primary-600">
                            {profileData?.username ? (
                              <Link href={`/${profileData.username}`} target="_blank" className="hover:underline">
                                /{profileData.username}
                              </Link>
                            ) : (
                              'Not set'
                            )}
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                          <p className="text-gray-900">{profileData?.full_name || 'Not set'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                          <p className="text-gray-900">{user?.email}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
                          <p className="text-gray-900">{profileData?.primary_mobile || 'Not set'}</p>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Business Description</label>
                          <p className="text-gray-900">{profileData?.business_description || 'Not set'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Address Information */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-primary-600" />
                        Business Address
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                          <p className="text-gray-900">{profileData?.business_address || 'Not set'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                          <p className="text-gray-900">{profileData?.city || 'Not set'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                          <p className="text-gray-900">{profileData?.state || 'Not set'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                          <p className="text-gray-900">{profileData?.pincode || 'Not set'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Banking Information */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-primary-600" />
                        Banking Details
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder Name</label>
                          <p className="text-gray-900">{profileData?.account_holder_name || 'Not set'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                          <p className="text-gray-900">{profileData?.account_number && profileData.account_number !== 'pending' ? '****' + profileData.account_number.slice(-4) : 'Not set'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                          <p className="text-gray-900">{profileData?.ifsc_code && profileData.ifsc_code !== 'pending' ? profileData.ifsc_code : 'Not set'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Verification Details */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary-600" />
                        Verification Details
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">ID Type</label>
                          <p className="text-gray-900">{profileData?.id_type || 'Not set'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">ID Number</label>
                          <p className="text-gray-900">{profileData?.id_number && profileData.id_number !== 'pending' ? '****' + profileData.id_number.slice(-4) : 'Not set'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Seller Story */}
                    {profileData?.story && (
                      <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                          <Star className="w-5 h-5 text-primary-600" />
                          Your Story
                        </h3>
                        <p className="text-gray-700 whitespace-pre-wrap">{profileData.story}</p>
                      </div>
                    )}

                    {/* Social Media Links */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary-600" />
                        Social Media
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {profileData?.instagram && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                              <Instagram className="w-4 h-4 text-pink-500" />
                              Instagram
                            </label>
                            <a href={profileData.instagram.startsWith('http') ? profileData.instagram : `https://instagram.com/${profileData.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                              {profileData.instagram}
                            </a>
                          </div>
                        )}
                        {profileData?.facebook && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                              <Facebook className="w-4 h-4 text-blue-600" />
                              Facebook
                            </label>
                            <a href={profileData.facebook.startsWith('http') ? profileData.facebook : `https://facebook.com/${profileData.facebook}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                              {profileData.facebook}
                            </a>
                          </div>
                        )}
                        {profileData?.x && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                              <Twitter className="w-4 h-4 text-gray-900" />
                              X (Twitter)
                            </label>
                            <a href={profileData.x.startsWith('http') ? profileData.x : `https://x.com/${profileData.x.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                              {profileData.x}
                            </a>
                          </div>
                        )}
                        {profileData?.linkedin && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                              <Linkedin className="w-4 h-4 text-blue-700" />
                              LinkedIn
                            </label>
                            <a href={profileData.linkedin.startsWith('http') ? profileData.linkedin : `https://linkedin.com/in/${profileData.linkedin}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                              {profileData.linkedin}
                            </a>
                          </div>
                        )}
                        {!profileData?.instagram && !profileData?.facebook && !profileData?.x && !profileData?.linkedin && (
                          <p className="text-gray-500 col-span-2">No social media links added</p>
                        )}
                      </div>
                    </div>

                    {/* Edit Button */}
                    <div className="flex justify-center">
                      <button 
                        onClick={() => {
                          setShowEditProfile(true)
                          fetchSellerProfile()
                        }}
                        className="inline-flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-xl font-semibold transition-colors shadow-lg hover:shadow-xl"
                      >
                        <Settings className="w-5 h-5" />
                        <span>Edit Profile</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    {/* Cover Photo/Video Section */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-primary-600" />
                        Cover Photo/Video
                      </h3>
                      
                      <div className="space-y-4">
                        {profileData.cover_photo && (
                          <div className="relative w-full h-48 rounded-lg overflow-hidden bg-gray-100">
                            {profileData.cover_photo.includes('.mp4') || profileData.cover_photo.includes('.webm') ? (
                              <video
                                src={profileData.cover_photo}
                                className="w-full h-full object-cover"
                                controls
                              />
                            ) : (
                              <img
                                src={profileData.cover_photo}
                                alt="Cover"
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                        )}
                        
                        <div>
                          <label className="block">
                            <span className="sr-only">Choose cover photo or video</span>
                            <input
                              type="file"
                              accept="image/jpeg,image/jpg,image/png,image/webp,video/mp4,video/webm"
                              onChange={handleCoverUpload}
                              disabled={uploadingCover}
                              className="block w-full text-sm text-gray-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-lg file:border-0
                                file:text-sm file:font-semibold
                                file:bg-primary-50 file:text-primary-700
                                hover:file:bg-primary-100
                                disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </label>
                          <p className="mt-2 text-xs text-gray-500">
                            Recommended: 1920x1080px. Supports JPEG, PNG, WebP (max 10MB) or MP4, WebM (max 50MB)
                          </p>
                          {uploadingCover && (
                            <div className="mt-2 text-sm text-primary-600 flex items-center gap-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-600 border-t-transparent"></div>
                              Uploading...
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Profile Photo Section */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <User className="w-5 h-5 text-primary-600" />
                        Profile Photo
                      </h3>
                      
                      <div className="space-y-4">
                        {user?.profile_photo && (
                          <div className="relative w-32 h-32 rounded-full overflow-hidden bg-gray-100 mx-auto">
                            <img
                              src={user.profile_photo}
                              alt="Profile"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        
                        <div>
                          <label className="block">
                            <span className="sr-only">Choose profile photo</span>
                            <input
                              type="file"
                              accept="image/jpeg,image/jpg,image/png,image/webp"
                              onChange={handleProfilePhotoUpload}
                              disabled={uploadingProfile}
                              className="block w-full text-sm text-gray-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-lg file:border-0
                                file:text-sm file:font-semibold
                                file:bg-primary-50 file:text-primary-700
                                hover:file:bg-primary-100
                                disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </label>
                          <p className="mt-2 text-xs text-gray-500">
                            Recommended: Square image, at least 400x400px. Supports JPEG, PNG, WebP (max 5MB)
                          </p>
                          {uploadingProfile && (
                            <p className="mt-2 text-sm text-primary-600 flex items-center gap-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-600 border-t-transparent"></div>
                              Uploading...
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Business Info Section */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold mb-4">Business Information</h3>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Business Description
                          </label>
                          <textarea
                            value={profileData.business_description}
                            onChange={(e) => setProfileData(prev => ({ ...prev, business_description: e.target.value }))}
                            rows={4}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            placeholder="Tell customers about your business and what makes it special..."
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Your Story (Featured on Homepage)
                          </label>
                          <textarea
                            value={profileData.story}
                            onChange={(e) => setProfileData(prev => ({ ...prev, story: e.target.value }))}
                            rows={4}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            placeholder="Share your journey as an artisan. This story will inspire customers on the homepage..."
                          />
                          <p className="text-sm text-gray-500 mt-1">
                            Tell your story: What inspired you to become an artisan? What makes your craft special?
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Social Media Section */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold mb-4">Social Media Links</h3>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                            <Instagram className="w-4 h-4" />
                            Instagram
                          </label>
                          <input
                            type="text"
                            value={profileData.instagram}
                            onChange={(e) => setProfileData(prev => ({ ...prev, instagram: e.target.value }))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            placeholder="https://instagram.com/yourbusiness"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                            <Facebook className="w-4 h-4" />
                            Facebook
                          </label>
                          <input
                            type="text"
                            value={profileData.facebook}
                            onChange={(e) => setProfileData(prev => ({ ...prev, facebook: e.target.value }))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            placeholder="https://facebook.com/yourbusiness"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                            <Twitter className="w-4 h-4" />
                            X (Twitter)
                          </label>
                          <input
                            type="text"
                            value={profileData.x}
                            onChange={(e) => setProfileData(prev => ({ ...prev, x: e.target.value }))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            placeholder="https://x.com/yourbusiness"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                            <Linkedin className="w-4 h-4" />
                            LinkedIn
                          </label>
                          <input
                            type="text"
                            value={profileData.linkedin}
                            onChange={(e) => setProfileData(prev => ({ ...prev, linkedin: e.target.value }))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            placeholder="https://linkedin.com/company/yourbusiness"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <button
                        onClick={handleUpdateProfile}
                        className="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={() => setShowEditProfile(false)}
                        className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
