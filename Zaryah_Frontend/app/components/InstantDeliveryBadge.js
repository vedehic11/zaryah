'use client'

import { motion } from 'framer-motion'
import { Truck, Clock } from 'lucide-react'
import { useAddress } from '../contexts/AddressContext'

export const InstantDeliveryBadge = ({ product, className = '' }) => {
  const { userCity } = useAddress()

  // Check if instant delivery is available
  const isInstantDeliveryAvailable = product?.instantDelivery

  if (!isInstantDeliveryAvailable) {
    return null
  }

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className={`bg-primary-100 text-primary-900 text-xs px-3 py-1.5 rounded-full flex items-center space-x-1 shadow-lg ${className}`}
    >
      <Truck className="w-3 h-3" />
      <span className="font-medium">Instant Delivery</span>
    </motion.div>
  )
}

export const DeliveryTimeEstimate = ({ product }) => {
  if (!product?.deliveryTime) return null;

  return (
    <div className="flex items-center space-x-2 text-sm">
      <Clock className="w-4 h-4 text-primary-500" />
      <span className="text-primary-700">
        {product.instantDelivery 
          ? `Delivery in ${product.deliveryTime.min}-${product.deliveryTime.max} ${product.deliveryTime.unit}`
          : `Delivery in ${product.deliveryTime.min}-${product.deliveryTime.max} ${product.deliveryTime.unit}`
        }
      </span>
    </div>
  )
}