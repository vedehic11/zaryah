'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { MessageCircle, Send, HelpCircle, FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { apiService } from '../services/api'
import toast from 'react-hot-toast'

export function BuyerSupportPage() {
  const [formData, setFormData] = useState({
    subject: '',
    message: '',
    priority: 'medium',
    category: 'other'
  })
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(false)
  const [fetchingTickets, setFetchingTickets] = useState(false)

  // Removed auto-fetch on mount - only fetch after submitting a ticket
  const fetchTickets = async () => {
    try {
      setFetchingTickets(true)
      const response = await fetch('/api/support/tickets')
      
      if (!response.ok) {
        throw new Error('Failed to fetch tickets')
      }
      
      const data = await response.json()
      setTickets(data || [])
    } catch (error) {
      console.error('Error fetching tickets:', error)
      // Silently fail - API might not be implemented yet
      setTickets([])
    } finally {
      setFetchingTickets(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.subject.trim() || !formData.message.trim()) {
      toast.error('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create ticket')
      }

      toast.success('Support ticket created successfully!')
      setFormData({
        subject: '',
        message: '',
        priority: 'medium',
        category: 'other'
      })
      
      // Refresh tickets list
      fetchTickets()
    } catch (error) {
      console.error('Error creating ticket:', error)
      toast.error(error.message || 'Failed to create ticket')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open': return <Clock className="w-4 h-4 text-yellow-500" />
      case 'in_progress': return <AlertCircle className="w-4 h-4 text-blue-500" />
      case 'resolved': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'closed': return <CheckCircle className="w-4 h-4 text-gray-500" />
      default: return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'bg-yellow-100 text-yellow-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'resolved': return 'bg-green-100 text-green-800'
      case 'closed': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 to-primary-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-soft border border-primary-100 p-6 sm:p-8"
        >
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-primary-100 rounded-xl">
              <MessageCircle className="w-8 h-8 text-primary-600" />
            </div>
            <h1 className="text-3xl font-bold text-charcoal-900 font-serif">Customer Support</h1>
          </div>

          <div className="space-y-6">
            <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <HelpCircle className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-charcoal-900 mb-1">How can we help you?</h3>
                  <p className="text-sm text-charcoal-600">
                    Submit a support ticket below and our team will get back to you as soon as possible.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-2">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="Brief description of your issue"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal-700 mb-2">
                    Category
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  >
                    <option value="other">Other</option>
                    <option value="payment">Payment Issue</option>
                    <option value="delivery">Delivery Issue</option>
                    <option value="product">Product Issue</option>
                    <option value="account">Account Issue</option>
                    <option value="technical">Technical Issue</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-charcoal-700 mb-2">
                    Priority
                  </label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-2">
                  Your Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows="5"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
                  placeholder="Describe your issue or question in detail..."
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md font-medium"
              >
                <Send className="w-5 h-5" />
                <span>{loading ? 'Submitting...' : 'Submit Ticket'}</span>
              </button>
            </form>

            {fetchingTickets ? (
              <div className="mt-8 text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-4 text-charcoal-600">Loading your tickets...</p>
              </div>
            ) : tickets.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xl font-bold text-charcoal-900 mb-4 flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-primary-600" />
                  <span>Your Tickets ({tickets.length})</span>
                </h2>
                <div className="space-y-3">
                  {tickets.map((ticket) => (
                    <div key={ticket.id} className="bg-cream-50 border border-primary-100 rounded-xl p-4 hover:shadow-md transition-all">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-charcoal-900 mb-1">{ticket.subject}</h3>
                          <p className="text-sm text-charcoal-600">{ticket.description}</p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-charcoal-500">
                          {new Date(ticket.created_at).toLocaleDateString()} {new Date(ticket.created_at).toLocaleTimeString()}
                        </span>
                        <span className={`px-2 py-1 rounded-full flex items-center space-x-1 ${getStatusColor(ticket.status)}`}>
                          {getStatusIcon(ticket.status)}
                          <span className="capitalize">{ticket.status.replace('_', ' ')}</span>
                        </span>
                        <span className={`px-2 py-1 rounded-full capitalize ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority}
                        </span>
                        <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded-full capitalize">
                          {ticket.category}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default BuyerSupportPage
