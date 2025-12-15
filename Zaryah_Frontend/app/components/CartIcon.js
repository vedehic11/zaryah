'use client'

import { motion } from 'framer-motion'
import { ShoppingBag } from 'lucide-react'
import { useCart } from '../contexts/CartContext'

export const CartIcon = () => {
  const { totalItems, setIsCartOpen } = useCart()

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => setIsCartOpen(true)}
      className="relative p-2 rounded-full text-charcoal-600 hover:bg-cream-100 transition-colors"
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