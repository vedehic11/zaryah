'use client'

import { createContext, useContext } from 'react'

const NotificationContext = createContext(undefined)

export const useNotification = () => {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider')
  }
  return context
}

export const NotificationProvider = ({ children }) => {
  // Notification state and functions can be added here as needed
  // For now, this is a minimal provider to satisfy the import
  
  const value = {
    // Add notification state/functions here when needed
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}
