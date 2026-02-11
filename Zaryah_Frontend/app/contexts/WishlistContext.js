'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { supabaseClient } from '@/lib/supabase-client'
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
  const { user } = useAuth()
  const [wishlist, setWishlist] = useState([])
  const [loading, setLoading] = useState(false)

  // Fetch wishlist when user logs in
  useEffect(() => {
    if (user) {
      fetchWishlist()
    } else {
      setWishlist([])
    }
  }, [user])

  const fetchWishlist = async () => {
    try {
      setLoading(true)
      
      // Get token from Supabase session
      const { data: { session } } = await supabaseClient.auth.getSession()
      const token = session?.access_token
      
      const response = await fetch('/api/wishlist', {
        credentials: 'include',
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : {}
      })

      // If unauthorized, just set empty wishlist (user not logged in)
      if (response.status === 401) {
        setWishlist([])
        return
      }

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Error fetching wishlist:', errorData)
        setWishlist([])
        return
      }

      const data = await response.json()
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
      // Get token from Supabase session
      const { data: { session } } = await supabaseClient.auth.getSession()
      const token = session?.access_token
      
      const response = await fetch('/api/wishlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({ product_id: productId })
      })

      const data = await response.json()

      // Handle unauthorized
      if (response.status === 401) {
        toast.error('Please login to add to wishlist')
        return false
      }

      if (response.ok) {
        await fetchWishlist()
        toast.success('Added to wishlist')
        return true
      } else if (data.exists) {
        toast.info('Already in wishlist')
        return true
      } else {
        console.error('Error adding to wishlist:', data)
        toast.error(data.error || 'Failed to add to wishlist')
        return false
      }
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
      // Get token from Supabase session
      const { data: { session } } = await supabaseClient.auth.getSession()
      const token = session?.access_token
      
      const response = await fetch(`/api/wishlist?product_id=${productId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : {}
      })

      if (response.ok) {
        await fetchWishlist()
        toast.success('Removed from wishlist')
        return true
      } else {
        toast.error('Failed to remove from wishlist')
        return false
      }
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
