'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Users, 
  Search, 
  Filter,
  SortAsc,
  SortDesc,
  CheckCircle,
  XCircle,
  Eye,
  Clock,
  AlertCircle,
  Star,
  Sparkles,
  MapPin,
  Phone,
  Mail,
  Building,
  FileText,
  Instagram,
  Facebook,
  Twitter,
  Linkedin
} from 'lucide-react'
import { UserAvatar } from './UserAvatar'
import { DocumentViewerModal } from './DocumentViewerModal'
import { apiService } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { supabaseClient } from '@/lib/supabase-client'
import toast from 'react-hot-toast'

export const AdminSellerManagementPage = ({ initialView = 'all' }) => {
  const { user, isLoading } = useAuth()
  const [sellers, setSellers] = useState([])
  const [filteredSellers, setFilteredSellers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState(initialView === 'pending' ? 'pending' : 'all')
  const [sortBy, setSortBy] = useState('registrationDate')
  const [sortOrder, setSortOrder] = useState('desc')
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false)

  // Update statusFilter when initialView prop changes
  useEffect(() => {
    setStatusFilter(initialView === 'pending' ? 'pending' : 'all')
  }, [initialView])

  // Fetch sellers from backend only when authenticated
  useEffect(() => {
    if (!isLoading && user?.userType === 'Admin') {
      setLoading(true)
      apiService.getSellersForAdmin()
        .then(data => {
          setSellers(data || [])
          setFilteredSellers(data || [])
        })
        .catch(err => {
          console.error('Error fetching sellers:', err)
          toast.error('Failed to fetch sellers')
        })
        .finally(() => setLoading(false))
    } else if (!isLoading) {
      // Not an admin, show error
      toast.error('You do not have permission to access this page')
      setLoading(false)
    }
  }, [user, isLoading])

  // Filter and sort sellers
  useEffect(() => {
    let filtered = sellers.filter(seller => {
      const matchesSearch = 
        seller.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        seller.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        seller.email.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'pending' && !seller.isApproved) ||
        (statusFilter === 'approved' && seller.isApproved) ||
        (statusFilter === 'unverified' && !seller.isVerified)
      
      return matchesSearch && matchesStatus
    })

    // Sort sellers
    filtered.sort((a, b) => {
      let aValue, bValue
      
      switch (sortBy) {
        case 'name':
          aValue = a.fullName.toLowerCase()
          bValue = b.fullName.toLowerCase()
          break
        case 'businessName':
          aValue = a.businessName.toLowerCase()
          bValue = b.businessName.toLowerCase()
          break
        case 'registrationDate':
          aValue = new Date(a.registrationDate)
          bValue = new Date(b.registrationDate)
          break
        case 'products':
          aValue = a.stats.products
          bValue = b.stats.products
          break
        case 'sales':
          aValue = a.stats.sales
          bValue = b.stats.sales
          break
        default:
          aValue = a.fullName.toLowerCase()
          bValue = b.fullName.toLowerCase()
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    setFilteredSellers(filtered)
  }, [sellers, searchTerm, statusFilter, sortBy, sortOrder])

  const handleApprove = async (sellerId) => {
    try {
      await apiService.approveSeller(sellerId, true)
      toast.success('Seller approved! Approval email will be sent.')
      // Refresh sellers
      const data = await apiService.getSellersForAdmin()
      setSellers(data)
      setFilteredSellers(data)
    } catch (err) {
      console.error('Error approving seller:', err)
      toast.error('Failed to approve seller')
    }
  }

  const handleReject = async (sellerId) => {
    try {
      await apiService.approveSeller(sellerId, false)
      toast.success('Seller rejected!')
      // Refresh sellers
      const data = await apiService.getSellersForAdmin()
      setSellers(data)
      setFilteredSellers(data)
    } catch (err) {
      console.error('Error rejecting seller:', err)
      toast.error('Failed to reject seller')
    }
  }

  const handleToggleFeaturedStory = async (sellerId, currentValue) => {
    try {
      // Get auth token
      const { data: { session } } = await supabaseClient.auth.getSession()
      const token = session?.access_token
      
      if (!token) {
        toast.error('Not authenticated')
        return
      }
      
      const response = await fetch('/api/admin/sellers', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sellerId,
          featured_story: !currentValue
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('Featured story update failed:', errorData)
        throw new Error(errorData.error || 'Failed to update featured story')
      }
      
      toast.success(!currentValue ? 'Story featured on homepage!' : 'Story removed from homepage')
      
      // Update local state
      setSellers(prev => prev.map(seller => 
        seller.id === sellerId 
          ? { ...seller, featured_story: !currentValue }
          : seller
      ))
      
      setFilteredSellers(prev => prev.map(seller => 
        seller.id === sellerId 
          ? { ...seller, featured_story: !currentValue }
          : seller
      ))
    } catch (err) {
      console.error('Error toggling featured story:', err)
      toast.error(err.message || 'Failed to update featured story')
    }
  }

  const handleVerify = (sellerId) => {
    setSellers(prev => prev.map(seller => 
      seller.id === sellerId 
        ? { ...seller, isVerified: true }
        : seller
    ))
  }

  const handleViewDocuments = (seller) => {
    const documents = []
    
    if (seller.idDocument) {
      documents.push({
        title: 'ID Document',
        description: `${seller.fullName}'s identification document`,
        url: seller.idDocument
      })
    }
    
    if (seller.businessDocument) {
      documents.push({
        title: 'Business Document',
        description: `Business registration for ${seller.businessName}`,
        url: seller.businessDocument
      })
    }
    
    if (seller.coverPhoto) {
      documents.push({
        title: 'Cover Photo',
        description: `Cover image for ${seller.businessName}`,
        url: seller.coverPhoto
      })
    }
    
    if (documents.length > 0) {
      setSelectedDocument(documents[0]) // Show first document
      setIsDocumentViewerOpen(true)
    } else {
      toast.error('No documents available for this seller')
    }
  }

  const getStatusBadge = (seller) => {
    if (!seller.isVerified) {
      return (
        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium flex items-center space-x-1">
          <AlertCircle className="w-3 h-3" />
          <span>Unverified</span>
        </span>
      )
    }
    if (!seller.isApproved) {
      return (
        <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium flex items-center space-x-1">
          <Clock className="w-3 h-3" />
          <span>Pending</span>
        </span>
      )
    }
    return (
      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium flex items-center space-x-1">
        <CheckCircle className="w-3 h-3" />
        <span>Approved</span>
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 py-4">
      <div className="max-w-full px-4 sm:px-6 lg:px-8">
        {/* Header - Only shown if not embedded in dashboard */}
        {typeof window !== 'undefined' && window.location.pathname === '/admin/sellers' && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Seller Management</h1>
            <p className="text-gray-600 mt-1">Manage seller registrations and approvals</p>
          </div>
        )}

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by name, business, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Status Filter - Only show when viewing all sellers */}
            {initialView === 'all' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="unverified">Unverified</option>
              </select>
            )}

            {/* Sort */}
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="registrationDate">Date</option>
                <option value="name">Name</option>
                <option value="businessName">Business</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
                title="Toggle sort order"
              >
                {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Sellers List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Seller</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Username</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Business</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSellers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                      No sellers found
                    </td>
                  </tr>
                ) : (
                  filteredSellers.map((seller, index) => (
                    <motion.tr
                      key={seller.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.02 }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <UserAvatar user={seller} size="sm" showName={true} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block bg-gray-100 px-3 py-1 rounded-full text-sm font-medium text-gray-800">@{seller.username}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{seller.businessName}</p>
                          <p className="text-xs text-gray-600 truncate">{seller.businessDescription}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <p className="text-gray-900">{seller.primaryMobile}</p>
                          <p className="text-xs text-gray-600">{seller.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(seller)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {!seller.isApproved && (
                            <>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleApprove(seller.id)}
                                className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-medium transition-colors"
                              >
                                Approve
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleReject(seller.id)}
                                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-medium transition-colors"
                              >
                                Reject
                              </motion.button>
                            </>
                          )}
                          {seller.isApproved && (
                            <>
                              <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                                ✓ Approved
                              </span>
                              {seller.story && (
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => handleToggleFeaturedStory(seller.id, seller.featured_story)}
                                  className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    seller.featured_story 
                                      ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' 
                                      : 'bg-gray-100 text-gray-500 hover:bg-yellow-50'
                                  }`}
                                  title={seller.featured_story ? 'Remove from homepage' : 'Feature on homepage'}
                                >
                                  <Sparkles className={`w-4 h-4 ${seller.featured_story ? 'fill-yellow-400' : ''}`} />
                                </motion.button>
                              )}
                            </>
                          )}
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              setSelectedDocument(seller.idDocument)
                              setIsDocumentViewerOpen(true)
                            }}
                            className="p-1.5 text-gray-500 hover:text-blue-600 transition-colors"
                            title="View documents"
                          >
                            <Eye className="w-4 h-4" />
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Document Viewer Modal */}
      {isDocumentViewerOpen && (
        <DocumentViewerModal
          documentUrl={selectedDocument}
          onClose={() => {
            setIsDocumentViewerOpen(false)
            setSelectedDocument(null)
          }}
        />
      )}
    </div>
  )
}
