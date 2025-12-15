'use client'

import { createContext, useContext } from 'react'

const AppContext = createContext(undefined)

export const useApp = () => {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}

export const AppProvider = ({ children }) => {
  // App-level state and functions can be added here as needed
  // For now, this is a minimal provider to satisfy the import
  
  const value = {
    // Add app-level state/functions here when needed
  }

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}
