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
import toast from 'react-hot-toast'

export const AdminSellerManagementPage = () => {
  const [sellers, setSellers] = useState([])
  const [filteredSellers, setFilteredSellers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('registrationDate')
  const [sortOrder, setSortOrder] = useState('desc')
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false)

  // Fetch sellers from backend
  useEffect(() => {
    // Fetch sellers from backend
    setLoading(true)
    apiService.getSellersForAdmin()
      .then(data => {
        setSellers(data)
        setFilteredSellers(data)
      })
      .catch(err => {
        console.error('Error fetching sellers:', err)
        toast.error('Failed to fetch sellers')
      })
      .finally(() => setLoading(false))
  }, [])

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
    <div className="min-h-screen bg-gradient-to-br from-cream-50 to-primary-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-charcoal-900 font-serif">Seller Management</h1>
          <p className="text-charcoal-600 mt-2">Manage seller registrations and approvals</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl p-6 shadow-soft border border-primary-100"
          >
            <div className="flex items-center">
              <div className="bg-primary-600 p-3 rounded-lg shadow-soft">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-charcoal-600">Total Sellers</p>
                <p className="text-2xl font-bold text-charcoal-900">{sellers.length}</p>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl p-6 shadow-soft border border-primary-100"
          >
            <div className="flex items-center">
              <div className="bg-green-600 p-3 rounded-lg shadow-soft">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-charcoal-600">Approved</p>
                <p className="text-2xl font-bold text-charcoal-900">
                  {sellers.filter(s => s.isApproved).length}
                </p>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl p-6 shadow-soft border border-primary-100"
          >
            <div className="flex items-center">
              <div className="bg-orange-600 p-3 rounded-lg shadow-soft">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-charcoal-600">Pending</p>
                <p className="text-2xl font-bold text-charcoal-900">
                  {sellers.filter(s => !s.isApproved && s.isVerified).length}
                </p>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl p-6 shadow-soft border border-primary-100"
          >
            <div className="flex items-center">
              <div className="bg-yellow-600 p-3 rounded-lg shadow-soft">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-charcoal-600">Unverified</p>
                <p className="text-2xl font-bold text-charcoal-900">
                  {sellers.filter(s => !s.isVerified).length}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-soft border border-primary-100 p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-charcoal-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search sellers by name, business, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="unverified">Unverified</option>
              </select>

              {/* Sort */}
              <div className="flex items-center space-x-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-2 border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="registrationDate">Registration Date</option>
                  <option value="name">Name</option>
                  <option value="businessName">Business Name</option>
                  <option value="products">Products</option>
                  <option value="sales">Sales</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-2 text-charcoal-400 hover:text-primary-600 transition-colors"
                >
                  {sortOrder === 'asc' ? <SortAsc className="w-5 h-5" /> : <SortDesc className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sellers List */}
        <div className="bg-white rounded-xl shadow-soft border border-primary-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-cream-50 border-b border-primary-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-charcoal-900">Seller</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-charcoal-900">Business</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-charcoal-900">Contact</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-charcoal-900">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-charcoal-900">Stats</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-charcoal-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-200">
                {filteredSellers.map((seller, index) => (
                  <motion.tr
                    key={seller.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-cream-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <UserAvatar user={seller} size="md" showName={true} />
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-charcoal-900">{seller.businessName}</p>
                        <p className="text-sm text-charcoal-600">{seller.businessDescription}</p>
                        <div className="flex items-center mt-1 text-xs text-charcoal-500">
                          <MapPin className="w-3 h-3 mr-1" />
                          <span>{seller.businessAddress}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center text-sm">
                          <Mail className="w-4 h-4 mr-2 text-charcoal-400" />
                          <span>{seller.email}</span>
                        </div>
                        <div className="flex items-center text-sm">
                          <Phone className="w-4 h-4 mr-2 text-charcoal-400" />
                          <span>{seller.primaryMobile}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(seller)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center text-sm">
                          <Building className="w-4 h-4 mr-2 text-charcoal-400" />
                          <span>{seller.stats.products} products</span>
                        </div>
                        <div className="flex items-center text-sm">
                          <Star className="w-4 h-4 mr-2 text-charcoal-400" />
                          <span>{seller.stats.sales} sales</span>
                        </div>
                        {seller.stats.rating > 0 && (
                          <div className="flex items-center text-sm">
                            <Star className="w-4 h-4 mr-2 text-yellow-400 fill-current" />
                            <span>{seller.stats.rating} rating</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleViewDocuments(seller)}
                          className="p-2 text-charcoal-400 hover:text-primary-600 transition-colors"
                          title="View Documents"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        
                        {!seller.isVerified && (
                          <button
                            onClick={() => handleVerify(seller.id)}
                            className="p-2 text-green-600 hover:text-green-700 transition-colors"
                            title="Verify Seller"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        
                        {seller.isVerified && !seller.isApproved && (
                          <>
                            <button
                              onClick={() => handleApprove(seller.id)}
                              className="p-2 text-green-600 hover:text-green-700 transition-colors"
                              title="Approve Seller"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleReject(seller.id)}
                              className="p-2 text-red-600 hover:text-red-700 transition-colors"
                              title="Reject Seller"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredSellers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-charcoal-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-charcoal-900 mb-2">No sellers found</h3>
            <p className="text-charcoal-600">Try adjusting your search or filter criteria.</p>
          </div>
        )}
      </div>

      {/* Document Viewer Modal */}
      <DocumentViewerModal
        isOpen={isDocumentViewerOpen}
        onClose={() => setIsDocumentViewerOpen(false)}
        document={selectedDocument}
      />
    </div>
  )
} 