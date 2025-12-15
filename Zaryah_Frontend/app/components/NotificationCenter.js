'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiService } from '../services/api'
import { Bell, Check, Trash2, X, Clock, Package, CreditCard, Gift, Settings } from 'lucide-react'
import toast from 'react-hot-toast'

export const NotificationCenter = () => {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Load notifications
  useEffect(() => {
    if (user && user.token) {
      loadNotifications()
    }
  }, [user])

  const loadNotifications = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiService.getNotifications()
      setNotifications(response.notifications || [])
      setUnreadCount(response.unreadCount || 0)
    } catch (error) {
      console.error('Error loading notifications:', error)
      setError('Failed to load notifications')
      toast.error('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId) => {
    try {
      await apiService.markNotificationAsRead(notificationId)
      setNotifications(prev => 
        prev.map(n => 
          n._id === notificationId ? { ...n, isRead: true } : n
        )
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking notification as read:', error)
      toast.error('Failed to mark notification as read')
    }
  }

  const markAllAsRead = async () => {
    try {
      await apiService.markAllNotificationsAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
      toast.success('All notifications marked as read')
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
      toast.error('Failed to mark all notifications as read')
    }
  }

  const deleteNotification = async (notificationId) => {
    try {
      await apiService.deleteNotification(notificationId)
      setNotifications(prev => prev.filter(n => n._id !== notificationId))
      if (!notifications.find(n => n._id === notificationId)?.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
      toast.success('Notification deleted')
    } catch (error) {
      console.error('Error deleting notification:', error)
      toast.error('Failed to delete notification')
    }
  }

  const deleteAllNotifications = async () => {
    try {
      await apiService.deleteAllNotifications()
      setNotifications([])
      setUnreadCount(0)
      toast.success('All notifications deleted')
    } catch (error) {
      console.error('Error deleting all notifications:', error)
      toast.error('Failed to delete all notifications')
    }
  }

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'order':
        return <Package className="w-4 h-4 text-blue-500" />
      case 'payment':
        return <CreditCard className="w-4 h-4 text-green-500" />
      case 'delivery':
        return <Package className="w-4 h-4 text-orange-500" />
      case 'promotion':
        return <Gift className="w-4 h-4 text-purple-500" />
      default:
        return <Settings className="w-4 h-4 text-gray-500" />
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now - date) / (1000 * 60 * 60)
    
    if (diffInHours < 1) {
      return 'Just now'
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`
    } else if (diffInHours < 168) {
      return `${Math.floor(diffInHours / 24)}d ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto py-8 px-4">
        <div className="flex items-center mb-6 gap-3">
          <div className="bg-primary-100 p-3 rounded-full shadow flex items-center justify-center">
            <Bell className="w-7 h-7 text-primary-600" />
          </div>
          <h2 className="text-2xl font-bold text-primary-800 tracking-tight">Notifications</h2>
        </div>
        <div className="text-center text-primary-600 py-8">
          <Clock className="w-8 h-8 mx-auto mb-2 animate-spin" />
          <span className="font-medium">Loading notifications...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto py-8 px-4">
        <div className="flex items-center mb-6 gap-3">
          <div className="bg-primary-100 p-3 rounded-full shadow flex items-center justify-center">
            <Bell className="w-7 h-7 text-primary-600" />
          </div>
          <h2 className="text-2xl font-bold text-primary-800 tracking-tight">Notifications</h2>
        </div>
        <div className="text-center text-red-600 py-8">
          <X className="w-8 h-8 mx-auto mb-2" />
          <span className="font-medium">{error}</span>
          <button 
            onClick={loadNotifications}
            className="mt-4 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary-100 p-3 rounded-full shadow flex items-center justify-center">
            <Bell className="w-7 h-7 text-primary-600" />
          </div>
          <h2 className="text-2xl font-bold text-primary-800 tracking-tight">Notifications</h2>
        </div>
        {notifications.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={markAllAsRead}
              className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded hover:bg-primary-200 transition-colors"
            >
              Mark all read
            </button>
            <button
              onClick={deleteAllNotifications}
              className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 transition-colors"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center text-gray-400 py-12 flex flex-col items-center">
          <Bell className="w-12 h-12 mb-2 text-gray-300" />
          <span className="font-medium text-lg">No notifications yet.</span>
          <span className="text-sm text-gray-400 mt-1">You'll see updates and alerts here.</span>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification._id}
              className={`bg-white rounded-xl shadow-md p-4 border transition-all ${
                notification.isRead 
                  ? 'border-gray-200 opacity-75' 
                  : 'border-primary-200 bg-primary-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  {getNotificationIcon(notification.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className={`font-semibold text-sm ${
                        notification.isRead ? 'text-gray-700' : 'text-gray-900'
                      }`}>
                        {notification.title}
                      </h4>
                      <p className={`text-sm mt-1 ${
                        notification.isRead ? 'text-gray-600' : 'text-gray-700'
                      }`}>
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-500">
                          {formatDate(notification.createdAt)}
                        </span>
                        {notification.priority === 'high' && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                            High Priority
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {!notification.isRead && (
                        <button
                          onClick={() => markAsRead(notification._id)}
                          className="p-1 text-green-600 hover:text-green-700 hover:bg-green-100 rounded transition-colors"
                          title="Mark as read"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification._id)}
                        className="p-1 text-red-600 hover:text-red-700 hover:bg-red-100 rounded transition-colors"
                        title="Delete notification"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}