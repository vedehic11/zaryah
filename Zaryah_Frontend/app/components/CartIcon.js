'use client'

import { motion } from 'framer-motion'
import { ShoppingBag } from 'lucide-react'
import { useCart } from '../contexts/CartContext'
import { useState } from 'react'

export const CartIcon = () => {
  const { totalItems, setIsCartOpen } = useCart()
  const [isClicking, setIsClicking] = useState(false)

  const handleClick = () => {
    setIsClicking(true)
    try {
      setIsCartOpen(true)
      console.log('Cart opened, totalItems:', totalItems)
    } catch (error) {
      console.error('Error opening cart:', error)
    } finally {
      setIsClicking(false)
    }
  }

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
      disabled={isClicking}
      className="relative p-2 rounded-full text-charcoal-600 hover:bg-cream-100 transition-colors disabled:opacity-50"
      aria-label="Shopping cart"
    >
      <ShoppingBag className="w-6 h-6" />
      {totalItems > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 bg-primary-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
        >
          {totalItems}
        </motion.div>
      )}
    </motion.button>
  )
}