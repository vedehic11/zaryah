'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Loader } from 'lucide-react'

export const UsernameInput = ({ value, onChange, error, className = '' }) => {
  const [checking, setChecking] = useState(false)
  const [available, setAvailable] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const checkUsername = async () => {
      if (!value || value.length < 3) {
        setAvailable(null)
        setMessage('')
        return
      }

      // Validate format
      const usernameRegex = /^[a-z0-9_-]+$/
      if (!usernameRegex.test(value)) {
        setAvailable(false)
        setMessage('Only lowercase letters, numbers, hyphens, and underscores allowed')
        return
      }

      if (value.length > 50) {
        setAvailable(false)
        setMessage('Username must be 50 characters or less')
        return
      }

      // Check reserved usernames
      const reserved = ['admin', 'api', 'www', 'mail', 'support', 'help', 'about', 'contact', 'shop', 'seller', 'buyer', 'zaryah']
      if (reserved.includes(value.toLowerCase())) {
        setAvailable(false)
        setMessage('This username is reserved')
        return
      }

      // Debounce API call
      const timeoutId = setTimeout(async () => {
        setChecking(true)
        try {
          const response = await fetch(`/api/sellers/username/check?username=${encodeURIComponent(value)}`)
          const data = await response.json()

          if (response.ok) {
            setAvailable(data.available)
            setMessage(data.message)
          } else {
            setAvailable(false)
            setMessage(data.error || 'Error checking username')
          }
        } catch (err) {
          setAvailable(false)
          setMessage('Error checking username')
        } finally {
          setChecking(false)
        }
      }, 500)

      return () => clearTimeout(timeoutId)
    }

    checkUsername()
  }, [value])

  return (
    <div className={className}>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const newValue = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '')
            onChange(newValue)
          }}
          placeholder="your-username"
          className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
            error ? 'border-red-300' : available === false ? 'border-red-300' : available === true ? 'border-green-300' : 'border-gray-300'
          }`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {checking && <Loader className="w-5 h-5 text-gray-400 animate-spin" />}
          {!checking && available === true && <CheckCircle className="w-5 h-5 text-green-500" />}
          {!checking && available === false && <XCircle className="w-5 h-5 text-red-500" />}
        </div>
      </div>
      
      {message && (
        <p className={`mt-2 text-sm ${
          available === true ? 'text-green-600' : 
          available === false ? 'text-red-600' : 
          'text-gray-600'
        }`}>
          {message}
        </p>
      )}
      
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}

      <p className="mt-2 text-xs text-gray-500">
        Your profile will be available at: <span className="font-mono text-primary-600">zaryah.com/{value || 'username'}</span>
      </p>
    </div>
  )
}


import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Loader } from 'lucide-react'

export const UsernameInput = ({ value, onChange, error, className = '' }) => {
  const [checking, setChecking] = useState(false)
  const [available, setAvailable] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const checkUsername = async () => {
      if (!value || value.length < 3) {
        setAvailable(null)
        setMessage('')
        return
      }

      // Validate format
      const usernameRegex = /^[a-z0-9_-]+$/
      if (!usernameRegex.test(value)) {
        setAvailable(false)
        setMessage('Only lowercase letters, numbers, hyphens, and underscores allowed')
        return
      }

      if (value.length > 50) {
        setAvailable(false)
        setMessage('Username must be 50 characters or less')
        return
      }

      // Check reserved usernames
      const reserved = ['admin', 'api', 'www', 'mail', 'support', 'help', 'about', 'contact', 'shop', 'seller', 'buyer', 'zaryah']
      if (reserved.includes(value.toLowerCase())) {
        setAvailable(false)
        setMessage('This username is reserved')
        return
      }

      // Debounce API call
      const timeoutId = setTimeout(async () => {
        setChecking(true)
        try {
          const response = await fetch(`/api/sellers/username/check?username=${encodeURIComponent(value)}`)
          const data = await response.json()

          if (response.ok) {
            setAvailable(data.available)
            setMessage(data.message)
          } else {
            setAvailable(false)
            setMessage(data.error || 'Error checking username')
          }
        } catch (err) {
          setAvailable(false)
          setMessage('Error checking username')
        } finally {
          setChecking(false)
        }
      }, 500)

      return () => clearTimeout(timeoutId)
    }

    checkUsername()
  }, [value])

  return (
    <div className={className}>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const newValue = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '')
            onChange(newValue)
          }}
          placeholder="your-username"
          className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
            error ? 'border-red-300' : available === false ? 'border-red-300' : available === true ? 'border-green-300' : 'border-gray-300'
          }`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {checking && <Loader className="w-5 h-5 text-gray-400 animate-spin" />}
          {!checking && available === true && <CheckCircle className="w-5 h-5 text-green-500" />}
          {!checking && available === false && <XCircle className="w-5 h-5 text-red-500" />}
        </div>
      </div>
      
      {message && (
        <p className={`mt-2 text-sm ${
          available === true ? 'text-green-600' : 
          available === false ? 'text-red-600' : 
          'text-gray-600'
        }`}>
          {message}
        </p>
      )}
      
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}

      <p className="mt-2 text-xs text-gray-500">
        Your profile will be available at: <span className="font-mono text-primary-600">zaryah.com/{value || 'username'}</span>
      </p>
    </div>
  )
}





