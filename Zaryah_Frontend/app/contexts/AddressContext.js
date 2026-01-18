'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { apiService } from '../services/api'
import toast from 'react-hot-toast'

const AddressContext = createContext(undefined)

export const useAddress = () => {
  const context = useContext(AddressContext)
  if (context === undefined) {
    throw new Error('useAddress must be used within an AddressProvider')
  }
  return context
}

export const AddressProvider = ({ children }) => {
  const { user } = useAuth()
  const [addresses, setAddresses] = useState([])
  const [selectedAddress, setSelectedAddress] = useState(null)
  const [defaultAddress, setDefaultAddress] = useState(null)
  const [loading, setLoading] = useState(false)
  const [userCity, setUserCity] = useState(null)
  const [isLocationLoading, setIsLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState(null)

  // Load user addresses from backend
  const loadUserAddresses = useCallback(async () => {
    if (!user?.id) return
    
    setLoading(true)
    try {
      const userAddresses = await apiService.getUserAddresses(user.id)
      setAddresses(userAddresses)
      
      // Set default address
      const defaultAddr = userAddresses.find(addr => addr.isDefault)
      if (defaultAddr) {
        setDefaultAddress(defaultAddr)
        setSelectedAddress(defaultAddr)
        setUserCity(defaultAddr.city)
      }
    } catch (error) {
      console.error('Error loading addresses:', error)
      toast.error('Failed to load addresses')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Load addresses from backend when user changes
  useEffect(() => {
    if (user?.id) {
      loadUserAddresses()
    } else {
      // Clear addresses when user logs out
      setAddresses([])
      setSelectedAddress(null)
      setDefaultAddress(null)
      setUserCity(null)
    }
  }, [user?.id, loadUserAddresses])

  // Add new address
  const addAddress = useCallback(async (addressData) => {
    if (!user?.id) {
      toast.error('Please login to save addresses')
      return null
    }

    setLoading(true)
    try {
      const newAddress = await apiService.addAddress(user.id, addressData)
      setAddresses(prev => [...prev, newAddress])
      
      // If this is the first address or marked as default, set as default
      if (newAddress.isDefault || addresses.length === 0) {
        setDefaultAddress(newAddress)
        setSelectedAddress(newAddress)
        setUserCity(newAddress.city)
      }
      
      toast.success('Address saved successfully')
      return newAddress
    } catch (error) {
      console.error('Error adding address:', error)
      toast.error('Failed to save address')
      return null
    } finally {
      setLoading(false)
    }
  }, [user?.id, addresses.length])

  // Update address
  const updateAddress = useCallback(async (addressId, addressData) => {
    setLoading(true)
    try {
      const updatedAddress = await apiService.updateAddress(addressId, addressData)
      setAddresses(prev => prev.map(addr => 
        (addr.id || addr._id) === addressId ? updatedAddress : addr
      ))
      
      // Update selected and default addresses if needed
      if ((selectedAddress?.id || selectedAddress?._id) === addressId) {
        setSelectedAddress(updatedAddress)
        setUserCity(updatedAddress.city)
      }
      if ((defaultAddress?.id || defaultAddress?._id) === addressId) {
        setDefaultAddress(updatedAddress)
      }
      
      toast.success('Address updated successfully')
      return updatedAddress
    } catch (error) {
      console.error('Error updating address:', error)
      toast.error('Failed to update address')
      return null
    } finally {
      setLoading(false)
    }
  }, [selectedAddress?.id, selectedAddress?._id, defaultAddress?.id, defaultAddress?._id])

  // Delete address
  const deleteAddress = useCallback(async (addressId) => {
    setLoading(true)
    try {
      await apiService.deleteAddress(addressId)
      setAddresses(prev => prev.filter(addr => (addr.id || addr._id) !== addressId))
      
      // Update selected and default addresses if needed
      if ((selectedAddress?.id || selectedAddress?._id) === addressId) {
        const newDefault = addresses.find(addr => (addr.id || addr._id) !== addressId && addr.isDefault)
        setSelectedAddress(newDefault || null)
        setUserCity(newDefault?.city || null)
      }
      if ((defaultAddress?.id || defaultAddress?._id) === addressId) {
        const newDefault = addresses.find(addr => (addr.id || addr._id) !== addressId && addr.isDefault)
        setDefaultAddress(newDefault || null)
      }
      
      toast.success('Address deleted successfully')
    } catch (error) {
      console.error('Error deleting address:', error)
      toast.error('Failed to delete address')
    } finally {
      setLoading(false)
    }
  }, [selectedAddress?.id, selectedAddress?._id, defaultAddress?.id, defaultAddress?._id, addresses])

  // Set default address
  const setDefaultAddressAPI = useCallback(async (addressId) => {
    setLoading(true)
    try {
      const updatedAddress = await apiService.setDefaultAddress(addressId)
      setAddresses(prev => prev.map(addr => ({
        ...addr,
        isDefault: addr._id === addressId
      })))
      
      setDefaultAddress(updatedAddress)
      setSelectedAddress(updatedAddress)
      setUserCity(updatedAddress.city)
      
      toast.success('Default address updated')
    } catch (error) {
      console.error('Error setting default address:', error)
      toast.error('Failed to set default address')
    } finally {
      setLoading(false)
    }
  }, [])

  // Select address for current session
  const selectAddress = useCallback((address) => {
    setSelectedAddress(address)
    setUserCity(address.city)
  }, [])

  // Location detection
  const requestLocation = useCallback(async () => {
    setIsLocationLoading(true)
    setLocationError(null)

    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by this browser')
      }

      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        })
      })

      const { latitude, longitude } = position.coords
      const detectedCity = getCityFromCoordinates(latitude, longitude)
      setUserCity(detectedCity)
      
      // Auto-create address if user is logged in and has no addresses
      if (user?.id && addresses.length === 0) {
        const autoAddress = {
          name: user.name || 'Home',
          phone: user.phone || '9999999999', // Fallback phone
          address: 'Auto-detected location',
          city: detectedCity,
          state: 'Maharashtra', // Default state
          pincode: '400001', // Default pincode
          isDefault: true
        }
        await addAddress(autoAddress)
      }
    } catch (error) {
      console.error('Location detection failed:', error)
      
      // Provide specific error messages based on error type
      let errorMessage = 'Unable to detect location. Please add an address manually.'
      
      if (error.code === 1) {
        errorMessage = 'Location access denied. Please enable location permissions in your browser.'
      } else if (error.code === 2) {
        errorMessage = 'Location unavailable. Please check your device settings.'
      } else if (error.code === 3) {
        errorMessage = 'Location request timed out. Please try again.'
      } else if (error.message?.includes('Geolocation is not supported')) {
        errorMessage = 'Your browser does not support location detection.'
      }
      
      setLocationError(errorMessage)
    } finally {
      setIsLocationLoading(false)
    }
  }, [user?.id, addresses.length, addAddress])

  // Mock city detection (in real app, use reverse geocoding API)
  const getCityFromCoordinates = (lat, lng) => {
    const cities = [
      { name: 'Mumbai', lat: 19.0760, lng: 72.8777, radius: 50 },
      { name: 'Delhi', lat: 28.7041, lng: 77.1025, radius: 50 },
      { name: 'Bangalore', lat: 12.9716, lng: 77.5946, radius: 50 },
      { name: 'Chennai', lat: 13.0827, lng: 80.2707, radius: 50 },
      { name: 'Kolkata', lat: 22.5726, lng: 88.3639, radius: 50 },
      { name: 'Hyderabad', lat: 17.3850, lng: 78.4867, radius: 50 },
      { name: 'Pune', lat: 18.5204, lng: 73.8567, radius: 50 },
      { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714, radius: 50 },
      { name: 'Jaipur', lat: 26.9124, lng: 75.7873, radius: 50 },
      { name: 'Lucknow', lat: 26.8467, lng: 80.9462, radius: 50 }
    ]

    for (const city of cities) {
      const distance = Math.sqrt(
        Math.pow(lat - city.lat, 2) + Math.pow(lng - city.lng, 2)
      )
      if (distance < city.radius / 111) {
        return city.name
      }
    }

    return 'Mumbai' // Default fallback
  }

  // Auto-detect location on first visit if user is logged in
  useEffect(() => {
    if (user?.id && !userCity && !localStorage.getItem('locationRequested')) {
      localStorage.setItem('locationRequested', 'true')
      requestLocation()
    }
  }, [user?.id, userCity, requestLocation])

  return (
    <AddressContext.Provider value={{
      addresses,
      selectedAddress,
      defaultAddress,
      loading,
      userCity,
      isLocationLoading,
      locationError,
      addAddress,
      updateAddress,
      deleteAddress,
      setDefaultAddress: setDefaultAddressAPI,
      selectAddress,
      requestLocation,
      setUserCity,
      loadUserAddresses
    }}>
      {children}
    </AddressContext.Provider>
  )
} 