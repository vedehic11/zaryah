'use client'

import { createContext, useContext } from 'react'

const RealtimeContext = createContext(undefined)

export const useRealtime = () => {
  const context = useContext(RealtimeContext)
  if (context === undefined) {
    throw new Error('useRealtime must be used within a RealtimeProvider')
  }
  return context
}

export const RealtimeProvider = ({ children }) => {
  // Realtime subscriptions and state can be added here as needed
  // For now, this is a minimal provider to satisfy the import
  
  const value = {
    // Add realtime subscriptions/state here when needed
  }

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  )
}

