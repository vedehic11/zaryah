'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { apiService } from '../services/api'
import toast from 'react-hot-toast'

const WishlistContext = createContext()

export const useWishlist = () => {
  const context = useContext(WishlistContext)
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider')
  }
  return context
}

export const WishlistProvider = ({ children }) => {
  const { user, isLoading: authLoading } = useAuth()
  const [wishlist, setWishlist] = useState([])
  const [loading, setLoading] = useState(false)

  // Fetch wishlist when user logs in
  useEffect(() => {
    if (user && !authLoading) {
      fetchWishlist()
    } else if (!user && !authLoading) {
      setWishlist([])
    }
  }, [user, authLoading])

  const fetchWishlist = async () => {
    try {
      setLoading(true)
      // Use centralized apiService which handles token retrieval, timeouts, and refresh
      const data = await apiService.request('/wishlist', { method: 'GET', timeoutMs: 10000 })
      if (!data) {
        setWishlist([])
        return
      }
      setWishlist(data)
    } catch (error) {
      console.error('Error fetching wishlist:', error)
      setWishlist([])
    } finally {
      setLoading(false)
    }
  }

  const addToWishlist = async (productId) => {
    if (!user) {
      toast.error('Please login to add to wishlist')
      return false
    }

    try {
      const result = await apiService.request('/wishlist', {
        method: 'POST',
        body: JSON.stringify({ product_id: productId }),
        timeoutMs: 10000
      })

      if (!result) {
        toast.error('Failed to add to wishlist')
        return false
      }

      // apiService.request throws on non-OK responses, so success here means added
      await fetchWishlist()
      toast.success('Added to wishlist')
      return true
    } catch (error) {
      console.error('Error adding to wishlist:', error)
      toast.error('Failed to add to wishlist')
      return false
    }
  }

  const removeFromWishlist = async (productId) => {
    if (!user) {
      return false
    }

    try {
      await apiService.request(`/wishlist?product_id=${encodeURIComponent(productId)}`, {
        method: 'DELETE',
        timeoutMs: 10000
      })

      await fetchWishlist()
      toast.success('Removed from wishlist')
      return true
    } catch (error) {
      console.error('Error removing from wishlist:', error)
      toast.error('Failed to remove from wishlist')
      return false
    }
  }

  const isInWishlist = (productId) => {
    return wishlist.some(item => item.product_id === productId)
  }

  const value = {
    wishlist,
    loading,
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
    fetchWishlist,
    wishlistCount: wishlist.length
  }

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  )
}
