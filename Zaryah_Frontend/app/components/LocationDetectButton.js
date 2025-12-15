'use client'

import { useState, useEffect } from 'react'
import { useAddress } from '../contexts/AddressContext'
import { useAuth } from '../contexts/AuthContext'
import { MapPin, Plus, Edit, Trash2, Check, X } from 'lucide-react'

export default function LocationDetectButton() {
  const { 
    userCity, 
    requestLocation, 
    isLocationLoading, 
    locationError, 
    setUserCity,
    addresses: savedAddresses,
    selectedAddress,
    addAddress,
    updateAddress,
    deleteAddress,
    selectAddress,
    setDefaultAddress
  } = useAddress()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [editingAddress, setEditingAddress] = useState(null)
  const [newAddress, setNewAddress] = useState({
    name: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    isDefault: false
  })

  const handleAddAddress = () => {
    if (!newAddress.name || !newAddress.phone || !newAddress.address || !newAddress.city || !newAddress.pincode) {
      alert('Please fill all required fields')
      return
    }

    addAddress(newAddress)
    
    // Reset form
    setNewAddress({
      name: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      isDefault: false
    })
    setShowAddressForm(false)
  }

  const handleEditAddress = (address) => {
    setEditingAddress(address)
    setNewAddress({
      name: address.name,
      phone: address.phone,
      address: address.address,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      isDefault: address.isDefault
    })
    setShowAddressForm(true)
  }

  const handleUpdateAddress = () => {
    if (!newAddress.name || !newAddress.phone || !newAddress.address || !newAddress.city || !newAddress.pincode) {
      alert('Please fill all required fields')
      return
    }

    updateAddress(editingAddress.id, newAddress)
    
    // Reset form
    setNewAddress({
      name: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      isDefault: false
    })
    setEditingAddress(null)
    setShowAddressForm(false)
  }

  const handleDeleteAddress = (addressId) => {
    if (confirm('Are you sure you want to delete this address?')) {
      deleteAddress(addressId)
    }
  }

  const handleSelectAddress = (address) => {
    selectAddress(address)
  }

  const handleSetDefault = (addressId) => {
    setDefaultAddress(addressId)
  }

  const resetForm = () => {
    setNewAddress({
      name: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      isDefault: false
    })
    setEditingAddress(null)
    setShowAddressForm(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed z-50 bottom-6 left-6 bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-full shadow-lg p-4 flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
        aria-label="Manage Address"
      >
        <MapPin className="w-5 h-5" />
        <span className="hidden md:inline font-semibold">Address</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-start">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl m-6 p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-primary-700">Delivery Address</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Current Location Detection */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-2">Current Location</h4>
              {isLocationLoading ? (
                <div className="text-sm text-gray-600">Detecting location...</div>
              ) : userCity ? (
                <div className="text-sm text-primary-700">
                  Detected city: <b>{userCity}</b>
                </div>
              ) : (
                <div className="text-sm text-gray-600">Location not detected.</div>
              )}
              {locationError && <div className="text-xs text-red-500 mt-1">{locationError}</div>}
              <button
                className="mt-2 w-full bg-primary-600 text-white rounded-lg py-2 font-semibold text-sm"
                onClick={requestLocation}
                disabled={isLocationLoading}
              >
                {isLocationLoading ? 'Detecting...' : 'Detect Location'}
              </button>
            </div>

            {/* Saved Addresses */}
            {savedAddresses.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-gray-800 mb-3">Saved Addresses</h4>
                <div className="space-y-3">
                  {savedAddresses.map((address) => (
                    <div
                      key={address.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedAddress?.id === address.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div
                          className="flex-1"
                          onClick={() => handleSelectAddress(address)}
                        >
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-medium text-gray-900">{address.name}</span>
                            {address.isDefault && (
                              <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                                Default
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 mb-1">{address.phone}</div>
                          <div className="text-sm text-gray-600">
                            {address.address}, {address.city}, {address.state} - {address.pincode}
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 ml-2">
                          {!address.isDefault && (
                            <button
                              onClick={() => handleSetDefault(address.id)}
                              className="p-1 text-gray-400 hover:text-primary-600"
                              title="Set as default"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteAddress(address.id)}
                            className="p-1 text-gray-400 hover:text-red-600"
                            title="Delete address"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Address Button */}
            <button
              onClick={() => setShowAddressForm(true)}
              className="w-full bg-primary-600 text-white rounded-lg py-3 font-semibold flex items-center space-x-2 hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Address</span>
            </button>

            {/* Address Form */}
            {showAddressForm && (
              <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
                <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg">
                      {editingAddress ? 'Edit Address' : 'Add New Address'}
                    </h3>
                    <button
                      onClick={resetForm}
                      className="text-gray-400 hover:text-gray-700"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={newAddress.name}
                        onChange={(e) => setNewAddress(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Enter full name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        value={newAddress.phone}
                        onChange={(e) => setNewAddress(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Enter phone number"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Address *
                      </label>
                      <textarea
                        value={newAddress.address}
                        onChange={(e) => setNewAddress(prev => ({ ...prev, address: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        rows="3"
                        placeholder="Enter complete address"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          City *
                        </label>
                        <input
                          type="text"
                          value={newAddress.city}
                          onChange={(e) => setNewAddress(prev => ({ ...prev, city: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          placeholder="Enter city"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          State
                        </label>
                        <input
                          type="text"
                          value={newAddress.state}
                          onChange={(e) => setNewAddress(prev => ({ ...prev, state: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          placeholder="Enter state"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Pincode *
                      </label>
                      <input
                        type="text"
                        value={newAddress.pincode}
                        onChange={(e) => setNewAddress(prev => ({ ...prev, pincode: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Enter pincode"
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isDefault"
                        checked={newAddress.isDefault}
                        onChange={(e) => setNewAddress(prev => ({ ...prev, isDefault: e.target.checked }))}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <label htmlFor="isDefault" className="text-sm text-gray-700">
                        Set as default address
                      </label>
                    </div>

                    <div className="flex space-x-3 pt-4">
                      <button
                        onClick={resetForm}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={editingAddress ? handleUpdateAddress : handleAddAddress}
                        className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        {editingAddress ? 'Update Address' : 'Save Address'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
} 