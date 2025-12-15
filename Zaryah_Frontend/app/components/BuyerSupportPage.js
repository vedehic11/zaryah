'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { MessageCircle, Send, HelpCircle, FileText } from 'lucide-react'

export function BuyerSupportPage() {
  const [message, setMessage] = useState('')
  const [tickets, setTickets] = useState([])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (message.trim()) {
      setTickets([...tickets, { id: Date.now(), message, date: new Date(), status: 'open' }])
      setMessage('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-lg p-6"
        >
          <div className="flex items-center space-x-3 mb-6">
            <MessageCircle className="w-8 h-8 text-orange-600" />
            <h1 className="text-3xl font-bold text-gray-900">Customer Support</h1>
          </div>

          <div className="space-y-6">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <HelpCircle className="w-5 h-5 text-orange-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">How can we help you?</h3>
                  <p className="text-sm text-gray-600">
                    Submit a support ticket below and our team will get back to you as soon as possible.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows="5"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Describe your issue or question..."
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-orange-600 text-white py-3 rounded-lg hover:bg-orange-700 transition-colors flex items-center justify-center space-x-2"
              >
                <Send className="w-5 h-5" />
                <span>Submit Ticket</span>
              </button>
            </form>

            {tickets.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
                  <FileText className="w-5 h-5" />
                  <span>Your Tickets</span>
                </h2>
                <div className="space-y-3">
                  {tickets.map((ticket) => (
                    <div key={ticket.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm text-gray-500">
                          {ticket.date.toLocaleDateString()} {ticket.date.toLocaleTimeString()}
                        </span>
                        <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                          {ticket.status}
                        </span>
                      </div>
                      <p className="text-gray-900">{ticket.message}</p>
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
