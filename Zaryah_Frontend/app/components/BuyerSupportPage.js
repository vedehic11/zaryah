'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { MessageCircle, Send, HelpCircle, FileText, Clock, CheckCircle, AlertCircle, X } from 'lucide-react'
import { apiService } from '../services/api'
import toast from 'react-hot-toast'
import { supabaseClient } from '@/lib/supabase-client'

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
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState({})

  // Fetch tickets on mount
  useEffect(() => {
    fetchTickets()
    fetchUnreadCounts()
    // Poll for unread counts every 30 seconds
    const interval = setInterval(fetchUnreadCounts, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchUnreadCounts = async () => {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession()
      const token = session?.access_token
      
      if (!token) return

      const response = await fetch('/api/support/tickets/unread-count', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        setUnreadCounts(data.unreadByTicket || {})
      }
    } catch (error) {
      console.error('Error fetching unread counts:', error)
    }
  }

  const fetchTickets = async () => {
    try {
      setFetchingTickets(true)
      
      // Get auth token
      const { data: { session } } = await supabaseClient.auth.getSession()
      const token = session?.access_token
      
      if (!token) {
        console.log('No auth token, skipping ticket fetch')
        return
      }

      const response = await fetch('/api/support/tickets', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch tickets')
      }
      
      const data = await response.json()
      setTickets(data || [])
    } catch (error) {
      console.error('Error fetching tickets:', error)
      toast.error('Failed to load support tickets')
      setTickets([])
    } finally {
      setFetchingTickets(false)
    }
  }

  const fetchMessages = async (ticketId) => {
    try {
      setLoadingMessages(true)
      
      const { data: { session } } = await supabaseClient.auth.getSession()
      const token = session?.access_token
      
      const response = await fetch(`/api/support/tickets/${ticketId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      })
      
      if (!response.ok) throw new Error('Failed to fetch messages')
      
      const data = await response.json()
      setMessages(data || [])
      // Clear unread count for this ticket
      setUnreadCounts(prev => ({ ...prev, [ticketId]: 0 }))
    } catch (error) {
      console.error('Error fetching messages:', error)
      toast.error('Failed to load messages')
    } finally {
      setLoadingMessages(false)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return

    try {
      setSendingMessage(true)
      
      const { data: { session } } = await supabaseClient.auth.getSession()
      const token = session?.access_token
      
      const response = await fetch(`/api/support/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify({ message: newMessage.trim() })
      })
      
      if (!response.ok) throw new Error('Failed to send message')
      
      const data = await response.json()
      setMessages([...messages, data])
      setNewMessage('')
      
      // Scroll to bottom
      setTimeout(() => {
        const messagesContainer = document.getElementById('messages-container')
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight
        }
      }, 100)
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
    } finally {
      setSendingMessage(false)
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
      // Get auth token
      const { data: { session } } = await supabaseClient.auth.getSession()
      const token = session?.access_token
      
      if (!token) {
        throw new Error('You must be logged in to create a support ticket')
      }

      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('Server response:', data)
        const errorMsg = data.error || data.message || 'Failed to create ticket'
        throw new Error(errorMsg)
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
            ) : tickets.length > 0 ? (
              <div className="mt-8">
                <h2 className="text-xl font-bold text-charcoal-900 mb-4 flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-primary-600" />
                  <span>Your Support Tickets ({tickets.length})</span>
                </h2>
                <div className="space-y-3">
                  {tickets.map((ticket) => (
                    <div key={ticket.id} className="bg-cream-50 border border-primary-100 rounded-xl p-4 hover:shadow-md transition-all">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-xs font-mono text-charcoal-500">{ticket.ticket_id}</span>
                          </div>
                          <h3 className="font-semibold text-charcoal-900 mb-1">{ticket.subject}</h3>
                          <p className="text-sm text-charcoal-600">{ticket.description}</p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedTicket(ticket)
                            fetchMessages(ticket.id)
                          }}
                          className="ml-3 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center space-x-2 text-sm relative"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>Open Chat</span>
                          {unreadCounts[ticket.id] > 0 && (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center animate-pulse">
                              {unreadCounts[ticket.id]}
                            </span>
                          )}
                        </button>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-charcoal-500">
                          {new Date(ticket.created_at).toLocaleDateString()} at {new Date(ticket.created_at).toLocaleTimeString()}
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
            ) : !fetchingTickets && (
              <div className="mt-8 text-center py-8 bg-cream-50 rounded-xl">
                <FileText className="w-12 h-12 text-charcoal-400 mx-auto mb-3" />
                <p className="text-charcoal-600">No support tickets yet</p>
                <p className="text-sm text-charcoal-500 mt-1">Submit a ticket above and it will appear here</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Chat Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl max-w-4xl w-full h-[85vh] flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900">{selectedTicket.subject}</h2>
                  <div className="flex items-center space-x-3 mt-2">
                    <span className="text-sm text-gray-500">#{selectedTicket.ticket_id}</span>
                    <span className={`px-2 py-1 rounded-full flex items-center space-x-1 ${getStatusColor(selectedTicket.status)}`}>
                      {getStatusIcon(selectedTicket.status)}
                      <span className="capitalize text-xs">{selectedTicket.status.replace('_', ' ')}</span>
                    </span>
                    <span className={`px-2 py-1 rounded-full capitalize text-xs ${getPriorityColor(selectedTicket.priority)}`}>
                      {selectedTicket.priority}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedTicket(null)
                    setMessages([])
                    setNewMessage('')
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Original Issue */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Original Issue:</h3>
              <p className="text-sm text-gray-600">{selectedTicket.description}</p>
            </div>

            {/* Chat Messages */}
            <div 
              id="messages-container"
              className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50"
            >
              {loadingMessages ? (
                <div className="flex justify-center items-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col justify-center items-center h-full text-gray-500">
                  <MessageCircle className="w-12 h-12 mb-3 text-gray-300" />
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${msg.is_admin ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                        msg.is_admin
                          ? 'bg-white text-gray-900 border border-gray-200'
                          : 'bg-primary-600 text-white'
                      }`}
                    >
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`text-xs font-semibold ${msg.is_admin ? 'text-gray-600' : 'text-primary-100'}`}>
                          {msg.is_admin ? 'Support Team' : 'You'}
                        </span>
                        <span className={`text-xs ${msg.is_admin ? 'text-gray-400' : 'text-primary-200'}`}>
                          {new Date(msg.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder={selectedTicket.status === 'closed' ? 'This ticket is closed' : 'Type your message...'}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  disabled={sendingMessage || selectedTicket.status === 'closed'}
                />
                <button
                  onClick={sendMessage}
                  disabled={sendingMessage || !newMessage.trim() || selectedTicket.status === 'closed'}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Send</span>
                </button>
              </div>
              {selectedTicket.status === 'closed' && (
                <p className="text-xs text-gray-500 mt-2">This ticket has been closed by support.</p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default BuyerSupportPage
