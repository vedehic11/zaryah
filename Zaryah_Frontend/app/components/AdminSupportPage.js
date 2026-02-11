'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  MessageSquare,
  Search,
  Filter,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  User,
  Package,
  ShoppingCart,
  Calendar,
  Edit,
  Save,
  X
} from 'lucide-react'
import { apiService } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export const AdminSupportPage = () => {
  const { user, isLoading } = useAuth()
  const [tickets, setTickets] = useState([])
  const [filteredTickets, setFilteredTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [editingStatus, setEditingStatus] = useState(false)
  const [editingPriority, setEditingPriority] = useState(false)
  const [additionalInfo, setAdditionalInfo] = useState('')

  useEffect(() => {
    if (!isLoading && user?.userType === 'Admin') {
      fetchTickets()
    } else if (!isLoading) {
      toast.error('Admin access required')
      setLoading(false)
    }
  }, [user, isLoading])

  const fetchTickets = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/support/tickets', {
        credentials: 'include'
      })
      
      if (!response.ok) throw new Error('Failed to fetch tickets')
      
      const data = await response.json()
      setTickets(data)
      setFilteredTickets(data)
    } catch (error) {
      console.error('Error fetching tickets:', error)
      toast.error('Failed to load support tickets')
    } finally {
      setLoading(false)
    }
  }

  // Filter tickets
  useEffect(() => {
    let filtered = tickets.filter(ticket => {
      const matchesSearch = 
        ticket.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.ticket_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.users?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.users?.email?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter
      const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter
      const matchesCategory = categoryFilter === 'all' || ticket.category === categoryFilter
      
      return matchesSearch && matchesStatus && matchesPriority && matchesCategory
    })

    setFilteredTickets(filtered)
  }, [tickets, searchTerm, statusFilter, priorityFilter, categoryFilter])

  const updateTicketStatus = async (ticketId, newStatus) => {
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      })

      if (!response.ok) throw new Error('Failed to update ticket')

      toast.success('Ticket status updated')
      fetchTickets()
      setEditingStatus(false)
    } catch (error) {
      console.error('Error updating ticket:', error)
      toast.error('Failed to update ticket status')
    }
  }

  const updateTicketPriority = async (ticketId, newPriority) => {
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ priority: newPriority })
      })

      if (!response.ok) throw new Error('Failed to update ticket')

      toast.success('Ticket priority updated')
      fetchTickets()
      setEditingPriority(false)
    } catch (error) {
      console.error('Error updating ticket:', error)
      toast.error('Failed to update ticket priority')
    }
  }

  const saveAdditionalInfo = async (ticketId, info) => {
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ additional_info: info })
      })

      if (!response.ok) throw new Error('Failed to save info')

      toast.success('Additional info saved')
      fetchTickets()
    } catch (error) {
      console.error('Error saving info:', error)
      toast.error('Failed to save additional info')
    }
  }

  const getStatusBadge = (status) => {
    const statusConfig = {
      open: { color: 'bg-blue-100 text-blue-700', icon: Clock, label: 'Open' },
      in_progress: { color: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle, label: 'In Progress' },
      resolved: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Resolved' },
      closed: { color: 'bg-gray-100 text-gray-700', icon: XCircle, label: 'Closed' }
    }
    const config = statusConfig[status] || statusConfig.open
    const Icon = config.icon
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </span>
    )
  }

  const getPriorityBadge = (priority) => {
    const priorityConfig = {
      low: { color: 'bg-gray-100 text-gray-700', label: 'Low' },
      medium: { color: 'bg-blue-100 text-blue-700', label: 'Medium' },
      high: { color: 'bg-orange-100 text-orange-700', label: 'High' },
      urgent: { color: 'bg-red-100 text-red-700', label: 'Urgent' }
    }
    const config = priorityConfig[priority] || priorityConfig.medium
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    )
  }

  const getCategoryIcon = (category) => {
    const icons = {
      order: ShoppingCart,
      product: Package,
      payment: Clock,
      delivery: Package,
      account: User,
      other: MessageSquare
    }
    return icons[category] || MessageSquare
  }

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    urgent: tickets.filter(t => t.priority === 'urgent').length
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard label="Total Tickets" value={stats.total} color="blue" />
        <StatCard label="Open" value={stats.open} color="blue" />
        <StatCard label="In Progress" value={stats.inProgress} color="yellow" />
        <StatCard label="Resolved" value={stats.resolved} color="green" />
        <StatCard label="Urgent" value={stats.urgent} color="red" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by ticket ID, subject, user name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All Priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              <option value="other">Other</option>
              <option value="payment">Payment</option>
              <option value="delivery">Delivery</option>
              <option value="product">Product</option>
              <option value="account">Account</option>
              <option value="technical">Technical</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filteredTickets.length === 0 ? (
          <div className="p-12 text-center">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No tickets found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTickets.map((ticket) => {
                  const CategoryIcon = getCategoryIcon(ticket.category)
                  return (
                    <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono text-gray-900">{ticket.ticket_id}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 max-w-xs truncate">{ticket.subject}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{ticket.users?.name || 'Unknown'}</div>
                        <div className="text-xs text-gray-500">{ticket.users?.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center text-sm text-gray-700">
                          <CategoryIcon className="w-4 h-4 mr-1" />
                          {ticket.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getPriorityBadge(ticket.priority)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(ticket.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => setSelectedTicket(ticket)}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedTicket.subject}</h2>
                  <p className="text-sm text-gray-500 mt-1">Ticket ID: {selectedTicket.ticket_id}</p>
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* User Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">User Information</h3>
                <div className="space-y-1 text-sm">
                  <p><span className="text-gray-600">Name:</span> {selectedTicket.users?.name}</p>
                  <p><span className="text-gray-600">Email:</span> {selectedTicket.users?.email}</p>
                </div>
              </div>

              {/* Ticket Details */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              {/* Related Order/Product */}
              {(selectedTicket.orders || selectedTicket.products) && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Related Information</h3>
                  {selectedTicket.orders && (
                    <div className="text-sm">
                      <p><span className="text-gray-600">Order ID:</span> {selectedTicket.orders.id}</p>
                      <p><span className="text-gray-600">Status:</span> {selectedTicket.orders.status}</p>
                    </div>
                  )}
                  {selectedTicket.products && (
                    <div className="text-sm mt-2">
                      <p><span className="text-gray-600">Product:</span> {selectedTicket.products.name}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Status Update */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <div className="flex items-center space-x-2">
                  <select
                    value={selectedTicket.status}
                    onChange={(e) => updateTicketStatus(selectedTicket.id, e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              {/* Priority Update */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <select
                  value={selectedTicket.priority}
                  onChange={(e) => updateTicketPriority(selectedTicket.id, e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              {/* Additional Info */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Additional Information</label>
                <textarea
                  value={additionalInfo || selectedTicket.additional_info || ''}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  placeholder="Add additional information or internal notes about this ticket..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
                <button
                  onClick={() => {
                    saveAdditionalInfo(selectedTicket.id, additionalInfo || selectedTicket.additional_info)
                  }}
                  className="mt-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Save Info
                </button>
              </div>

              {/* Timestamps */}
              <div className="text-sm text-gray-500 space-y-1">
                <p>Created: {new Date(selectedTicket.created_at).toLocaleString()}</p>
                <p>Updated: {new Date(selectedTicket.updated_at).toLocaleString()}</p>
                {selectedTicket.resolved_at && (
                  <p>Resolved: {new Date(selectedTicket.resolved_at).toLocaleString()}</p>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

const StatCard = ({ label, value, color }) => {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
    gray: 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-2 ${colorClasses[color].split(' ')[1]}`}>{value}</p>
    </div>
  )
}
