'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { MapPin, Navigation, X, Check } from 'lucide-react'
import { useAddress } from '../contexts/AddressContext'

export const AddressDetectionModal = ({ isOpen, onClose, onAddressDetected }) => {
  const { requestLocation, isLocationLoading, locationError, userCity } = useAddress()
  const [manualCity, setManualCity] = useState('')
  const [showManualInput, setShowManualInput] = useState(false)

  const cities = [
    'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 
    'Hyderabad', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow'
  ]

  const handleAutoDetect = async () => {
    try {
      await requestLocation()
      if (userCity) {
        onAddressDetected({
          city: userCity,
          state: 'Maharashtra', // Default state
          pincode: '400001' // Default pincode
        })
        onClose()
      }
    } catch (error) {
      console.error('Location detection failed:', error)
    }
  }

  const handleManualSelect = () => {
    if (manualCity) {
      onAddressDetected({
        city: manualCity,
        state: 'Maharashtra', // Default state
        pincode: '400001' // Default pincode
      })
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl p-6 max-w-md w-full"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-charcoal-900">Set Your Location</h2>
          <button
            onClick={onClose}
            className="text-charcoal-400 hover:text-charcoal-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Auto Detection */}
          <div className="bg-primary-50 rounded-lg p-4">
            <div className="flex items-center space-x-3 mb-3">
              <Navigation className="w-5 h-5 text-primary-600" />
              <h3 className="font-semibold text-charcoal-900">Auto Detect Location</h3>
            </div>
            <p className="text-sm text-charcoal-600 mb-4">
              Allow us to automatically detect your city for better delivery experience
            </p>
            <button
              onClick={handleAutoDetect}
              disabled={isLocationLoading}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition-colors"
            >
              {isLocationLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Detecting...</span>
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4" />
                  <span>Detect My Location</span>
                </>
              )}
            </button>
            {locationError && (
              <p className="text-sm text-error-600 mt-2">{locationError}</p>
            )}
          </div>

          {/* Manual Selection */}
          <div className="bg-cream-50 rounded-lg p-4">
            <div className="flex items-center space-x-3 mb-3">
              <MapPin className="w-5 h-5 text-warm-600" />
              <h3 className="font-semibold text-charcoal-900">Select Manually</h3>
            </div>
            <p className="text-sm text-charcoal-600 mb-4">
              Choose your city from the list below
            </p>
            
            {!showManualInput ? (
              <button
                onClick={() => setShowManualInput(true)}
                className="w-full bg-warm-600 hover:bg-warm-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Choose City
              </button>
            ) : (
              <div className="space-y-3">
                <select
                  value={manualCity}
                  onChange={(e) => setManualCity(e.target.value)}
                  className="w-full px-3 py-2 border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select a city</option>
                  {cities.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
                <div className="flex space-x-2">
                  <button
                    onClick={handleManualSelect}
                    disabled={!manualCity}
                    className="flex-1 bg-warm-600 hover:bg-warm-700 disabled:bg-warm-300 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Confirm
                  </button>
                  <button
                    onClick={() => {
                      setShowManualInput(false)
                      setManualCity('')
                    }}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Skip Option */}
          <div className="text-center">
            <button
              onClick={onClose}
              className="text-charcoal-500 hover:text-charcoal-700 text-sm"
            >
              Skip for now
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
} 