'use client'

import { useState } from 'react'
import { User } from 'lucide-react'

export const UserAvatar = ({ 
  user, 
  size = 'md', 
  className = '',
  showName = false 
}) => {
  const [imageError, setImageError] = useState(false)
  
  // Get user initials from name
  const getInitials = (name) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Size classes
  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl',
    '2xl': 'w-20 h-20 text-2xl'
  }

  // Background colors for different user types
  const getBackgroundColor = (role) => {
    switch (role) {
      case 'seller':
        return 'bg-secondary-600'
      case 'admin':
        return 'bg-primary-600'
      case 'buyer':
      default:
        return 'bg-mint-600'
    }
  }

  const avatarSize = sizeClasses[size] || sizeClasses.md
  const bgColor = getBackgroundColor(user?.role)
  const initials = getInitials(user?.fullName || user?.name || user?.businessName)

  // If user has a profile photo and image hasn't errored, show the photo
  if (user?.profilePhoto && !imageError) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className={`${avatarSize} rounded-full overflow-hidden flex-shrink-0`}>
          <img
            src={user.profilePhoto}
            alt={user.fullName || user.name || user.businessName || 'User'}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        </div>
        {showName && (
          <span className="font-medium text-gray-900">
            {user.fullName || user.name || user.businessName || 'User'}
          </span>
        )}
      </div>
    )
  }

  // Show standard avatar with initials
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className={`${avatarSize} rounded-full ${bgColor} text-white flex items-center justify-center font-semibold flex-shrink-0`}>
        {initials}
      </div>
      {showName && (
        <span className="font-medium text-gray-900">
          {user?.fullName || user?.name || user?.businessName || 'User'}
        </span>
      )}
    </div>
  )
} 