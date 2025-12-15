'use client'

import { createContext, useContext, useState, useEffect } from 'react'

const LocationContext = createContext(undefined)

export const useLocation = () => {
  const context = useContext(LocationContext)
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider')
  }
  return context
}

// Mock city detection based on coordinates (in real app, use reverse geocoding API)
const getCityFromCoordinates = (lat, lng) => {
  // Mock implementation - in real app, use Google Maps Geocoding API or similar
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
    if (distance < city.radius / 111) { // Rough conversion to degrees
      return city.name
    }
  }

  return 'Mumbai' // Default fallback
}

export const LocationProvider = ({ children }) => {
  const [userCity, setUserCityState] = useState(null)
  const [isLocationLoading, setIsLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState(null)
  const [savedAddresses, setSavedAddresses] = useState([])
  const [selectedAddress, setSelectedAddress] = useState(null)

  useEffect(() => {
    // Load from localStorage on client side only
    if (typeof window !== 'undefined') {
      const savedCity = localStorage.getItem('userCity')
      if (savedCity) {
        setUserCityState(savedCity)
      }

      // Load saved addresses
      const savedAddressesData = localStorage.getItem('savedAddresses')
      if (savedAddressesData) {
        const addresses = JSON.parse(savedAddressesData)
        setSavedAddresses(addresses)
        
        // Set default address if exists
        const defaultAddress = addresses.find(addr => addr.isDefault)
        if (defaultAddress) {
          setSelectedAddress(defaultAddress)
          if (!savedCity) {
            setUserCityState(defaultAddress.city)
            localStorage.setItem('userCity', defaultAddress.city)
          }
        }
      }
    }
  }, [])

  const setUserCity = (city) => {
    setUserCityState(city)
    if (typeof window !== 'undefined') {
      localStorage.setItem('userCity', city)
    }
    setLocationError(null)
  }

  const requestLocation = async () => {
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
    } catch (error) {
      console.error('Location detection failed:', error)
      setLocationError('Unable to detect location. Please add an address manually.')
    } finally {
      setIsLocationLoading(false)
    }
  }

  const addAddress = (address) => {
    const addressToAdd = {
      ...address,
      id: Date.now().toString()
    }

    let updatedAddresses = [...savedAddresses]
    
    // If this is the first address or marked as default, make it default
    if (addressToAdd.isDefault || updatedAddresses.length === 0) {
      updatedAddresses = updatedAddresses.map(addr => ({ ...addr, isDefault: false }))
      addressToAdd.isDefault = true
    }

    updatedAddresses.push(addressToAdd)
    setSavedAddresses(updatedAddresses)
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('savedAddresses', JSON.stringify(updatedAddresses))
    }
    
    // Set as selected address and update city
    setSelectedAddress(addressToAdd)
    setUserCity(addressToAdd.city)
    
    return addressToAdd
  }

  const updateAddress = (addressId, updatedAddress) => {
    const updatedAddresses = savedAddresses.map(addr => 
      addr.id === addressId ? { ...updatedAddress, id: addressId } : addr
    )
    
    // Handle default address logic
    if (updatedAddress.isDefault) {
      updatedAddresses.forEach(addr => {
        addr.isDefault = addr.id === addressId
      })
    }

    setSavedAddresses(updatedAddresses)
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('savedAddresses', JSON.stringify(updatedAddresses))
    }
    
    // Update selected address if it was the edited one
    if (selectedAddress && selectedAddress.id === addressId) {
      const newSelectedAddress = updatedAddresses.find(addr => addr.id === addressId)
      setSelectedAddress(newSelectedAddress)
      setUserCity(newSelectedAddress.city)
    }
  }

  const deleteAddress = (addressId) => {
    const updatedAddresses = savedAddresses.filter(addr => addr.id !== addressId)
    setSavedAddresses(updatedAddresses)
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('savedAddresses', JSON.stringify(updatedAddresses))
    }
    
    // If deleted address was selected, clear selection
    if (selectedAddress && selectedAddress.id === addressId) {
      setSelectedAddress(null)
      setUserCity(null)
    }
  }

  const selectAddress = (address) => {
    setSelectedAddress(address)
    setUserCity(address.city)
  }

  const setDefaultAddress = (addressId) => {
    const updatedAddresses = savedAddresses.map(addr => ({
      ...addr,
      isDefault: addr.id === addressId
    }))
    setSavedAddresses(updatedAddresses)
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('savedAddresses', JSON.stringify(updatedAddresses))
    }
  }

  const saveAddressFromRegistration = (address) => {
    const addressToSave = {
      ...address,
      id: Date.now().toString(),
      isDefault: true
    }
    
    // Clear existing addresses and set this as the only one
    const updatedAddresses = [addressToSave]
    setSavedAddresses(updatedAddresses)
    setSelectedAddress(addressToSave)
    setUserCity(addressToSave.city)
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('savedAddresses', JSON.stringify(updatedAddresses))
      localStorage.setItem('userCity', addressToSave.city)
    }
  }

  // Auto-detect location on first visit
  useEffect(() => {
    if (typeof window !== 'undefined' && !userCity && !localStorage.getItem('locationRequested')) {
      localStorage.setItem('locationRequested', 'true')
      requestLocation()
    }
  }, [userCity])

  return (
    <LocationContext.Provider value={{
      userCity,
      isLocationLoading,
      requestLocation,
      setUserCity,
      locationError,
      savedAddresses,
      selectedAddress,
      addAddress,
      updateAddress,
      deleteAddress,
      selectAddress,
      setDefaultAddress,
      saveAddressFromRegistration
    }}>
      {children}
    </LocationContext.Provider>
  )
}