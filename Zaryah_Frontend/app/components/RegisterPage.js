'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { 
  Mail, Lock, Eye, EyeOff, User, MapPin, Building, FileText, Phone, Sparkles, Instagram, Facebook, Twitter, Linkedin, Camera, ArrowLeft, ArrowRight, CheckCircle, AlertCircle, Upload, X, File, Navigation2
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAddress } from '../contexts/AddressContext'
import { OtpVerification } from './OtpVerification'
import { AddressDetectionModal } from './AddressDetectionModal'
import Link from 'next/link'
import { apiService } from '../services/api'

export const RegisterPage = () => {
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'buyer',
    city: 'Mumbai',
    // Address fields
    address: {
      fullName: '',
      phone: '',
      address: '',
      city: 'Mumbai',
      state: '',
      pincode: '',
      isDefault: true
    },
    businessName: '',
    username: '',
    description: '',
    businessAddress: '',
    idNumber: '',
    idType: 'aadhar',
    accountHolderName: '',
    bankAccountNumber: '',
    ifscCode: '',
    instagram: '',
    facebook: '',
    x: '',
    linkedin: '',
    acceptTerms: false,
    acceptPrivacyPolicy: false,
    acceptSellerAgreement: false
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [uploadedFiles, setUploadedFiles] = useState({ idDocument: null, businessDocuments: [] })
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState(null)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const { register, isLoading, pendingVerification } = useAuth()
  const { addAddress, requestLocation, userCity, isLocationLoading } = useAddress()
  const router = useRouter()
  const [showAddressModal, setShowAddressModal] = useState(false)

  const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune', 'Ahmedabad']
  const idTypes = [
    { value: 'aadhar', label: 'Aadhar Card' },
    { value: 'pan', label: 'PAN Card' },
    { value: 'driving_license', label: 'Driving License' },
    { value: 'passport', label: 'Passport' }
  ]

  // --- File Upload Handlers ---
  const handleFileUpload = useCallback((file, type) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (!allowedTypes.includes(file.type)) {
      setErrors(prev => ({ ...prev, [type]: 'Please upload a valid file (JPEG, PNG, or PDF)' }))
      return
    }
    if (file.size > maxSize) {
      setErrors(prev => ({ ...prev, [type]: 'File size should be less than 5MB' }))
      return
    }
    if (type === 'businessDocuments') {
      setUploadedFiles(prev => ({ ...prev, businessDocuments: [...prev.businessDocuments, file] }))
    } else {
      setUploadedFiles(prev => ({ ...prev, [type]: file }))
    }
    if (errors[type]) setErrors(prev => ({ ...prev, [type]: '' }))
  }, [errors])

  const handleDragOver = useCallback(e => { e.preventDefault(); setIsDragOver(true) }, [])
  const handleDragLeave = useCallback(e => { e.preventDefault(); setIsDragOver(false) }, [])
  const handleDrop = useCallback((e, type) => {
    e.preventDefault(); setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) handleFileUpload(files[0], type)
  }, [handleFileUpload])
  const handleFileInput = useCallback((e, type) => {
    const files = Array.from(e.target.files)
    if (files.length > 0) {
      if (type === 'businessDocuments') files.forEach(file => handleFileUpload(file, type))
      else handleFileUpload(files[0], type)
    }
  }, [handleFileUpload])
  const removeFile = (type, index) => {
    if (type === 'businessDocuments' && index !== undefined) {
      setUploadedFiles(prev => ({ ...prev, businessDocuments: prev.businessDocuments.filter((_, i) => i !== index) }))
    } else {
      setUploadedFiles(prev => ({ ...prev, [type]: type === 'businessDocuments' ? [] : null }))
    }
  }
  const formatFileSize = bytes => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
  const getFileIcon = fileType => {
    if (fileType.includes('image')) return <Camera className="h-4 w-4" />
    if (fileType.includes('pdf')) return <File className="h-4 w-4" />
    return <FileText className="h-4 w-4" />
  }

  // Check username availability with debounce
  const checkUsernameAvailability = async (username) => {
    if (!username || username.length < 3) {
      setUsernameAvailable(null)
      return
    }

    // Validate format
    const usernameRegex = /^[a-z0-9_-]+$/
    if (!usernameRegex.test(username)) {
      setUsernameAvailable(false)
      setErrors(prev => ({ ...prev, username: 'Only lowercase letters, numbers, hyphens, and underscores allowed' }))
      return
    }

    setCheckingUsername(true)
    try {
      const response = await fetch(`/api/sellers/check-username?username=${encodeURIComponent(username)}`)
      const data = await response.json()
      setUsernameAvailable(data.available)
      if (!data.available) {
        setErrors(prev => ({ ...prev, username: 'This username is already taken' }))
      } else {
        setErrors(prev => {
          const newErrors = { ...prev }
          delete newErrors.username
          return newErrors
        })
      }
    } catch (error) {
      console.error('Error checking username:', error)
    } finally {
      setCheckingUsername(false)
    }
  }

  // --- Input Change & Validation ---
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    
    if (name.startsWith('address.')) {
      const addressField = name.split('.')[1]
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value
        }
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
        // Auto-populate address.fullName with name
        ...(name === 'name' && { address: { ...prev.address, fullName: value } })
      }))
      
      // Check username availability with debounce
      if (name === 'username') {
        setUsernameAvailable(null)
        const lowerValue = value.toLowerCase()
        if (lowerValue.length >= 3) {
          setTimeout(() => {
            checkUsernameAvailability(lowerValue)
          }, 500)
        }
      }
    }
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }
  const validateCurrentStep = () => {
    const newErrors = {}
    
    if (currentStep === 1) {
      if (!formData.name.trim()) newErrors.name = 'Full name is required'
      if (!formData.email.trim()) newErrors.email = 'Email is required'
      else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Please enter a valid email'
      if (!formData.password) newErrors.password = 'Password is required'
      else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters'
      if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match'
      if (!formData.acceptTerms) newErrors.acceptTerms = 'You must accept the terms and conditions'
      if (!formData.acceptPrivacyPolicy) newErrors.acceptPrivacyPolicy = 'You must accept the privacy policy'
      if (formData.role === 'seller' && !formData.acceptSellerAgreement) newErrors.acceptSellerAgreement = 'You must accept the seller agreement'
    }
    
    if (currentStep === 2) {
      // Address validation
      if (!formData.address.phone.trim()) newErrors['address.phone'] = 'Phone number is required'
      if (!formData.address.address.trim()) newErrors['address.address'] = 'Address is required'
      if (!formData.address.city.trim()) newErrors['address.city'] = 'City is required'
      if (!formData.address.pincode.trim()) newErrors['address.pincode'] = 'Pincode is required'
      else if (!/^\d{6}$/.test(formData.address.pincode)) newErrors['address.pincode'] = 'Please enter a valid 6-digit pincode'
    }
    
    if (currentStep === 3 && formData.role === 'seller') {
      // Business info validation
      if (!formData.businessName.trim()) newErrors.businessName = 'Business name is required'
      if (!formData.username.trim()) newErrors.username = 'Username is required'
      else if (formData.username.length < 3) newErrors.username = 'Username must be at least 3 characters'
      else if (!/^[a-z0-9_-]+$/.test(formData.username)) newErrors.username = 'Only lowercase letters, numbers, hyphens, and underscores allowed'
      else if (usernameAvailable === false) newErrors.username = 'This username is already taken'
      if (!formData.description.trim()) newErrors.description = 'Business description is required'
      if (!formData.businessAddress.trim()) newErrors.businessAddress = 'Business address is required'
    }
    
    if (currentStep === 4 && formData.role === 'seller') {
      // Verification validation
      if (!formData.idNumber.trim()) newErrors.idNumber = 'ID number is required'
      if (!uploadedFiles.idDocument) newErrors.verificationDoc = 'ID document is required'
      if (!formData.accountHolderName.trim()) newErrors.accountHolderName = 'Account holder name is required'
      if (!formData.bankAccountNumber.trim()) newErrors.bankAccountNumber = 'Bank account number is required'
      if (!formData.ifscCode.trim()) newErrors.ifscCode = 'IFSC code is required'
      
      // Check if at least one social media field is filled
      const hasSocialMedia = formData.instagram?.trim() || formData.facebook?.trim() || formData.x?.trim() || formData.linkedin?.trim()
      if (!hasSocialMedia) newErrors.socialMedia = 'At least one social media link is required'
    }
    
    setErrors(newErrors)
    
    // Debug: log validation results
    if (Object.keys(newErrors).length > 0) {
      console.log('Validation errors:', newErrors)
      console.log('Current form data:', formData)
    }
    
    return Object.keys(newErrors).length === 0
  }

  // --- Navigation ---
  const nextStep = () => {
    if (validateCurrentStep()) {
      if (currentStep === 1) {
        setCurrentStep(2) // Go to address step
      } else if (currentStep === 2) {
        if (formData.role === 'seller') {
          setCurrentStep(3) // Go to business info step
        } else {
          // For buyers, register now
          handleSubmit()
        }
      } else if (currentStep === 3) {
        if (formData.role === 'seller') {
          setCurrentStep(4) // Go to verification step
        } else {
          // This shouldn't happen for buyers, but just in case
          handleSubmit()
        }
      } else if (currentStep === 4) {
        // For sellers, register now
        handleSubmit()
      }
    } else {
      // Show toast if validation fails
      toast.error('Please fill all required fields correctly')
    }
  }
  const prevStep = () => setCurrentStep(prev => prev - 1)

  // --- File Upload to Cloudinary ---
  const uploadFileToCloud = async (file, folder = 'seller-documents') => {
    if (!file) return null
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', folder)
      formData.append('useSupabase', 'false') // Use Cloudinary
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }
      
      const data = await response.json()
      return data.url
    } catch (error) {
      console.error('Error uploading file:', error)
      toast.error(`Failed to upload ${file.name}`)
      return null
    }
  }

  // --- Submit Handler ---
  const handleSubmit = async e => {
    if (e) e.preventDefault()
    
    // Validate the current step before submitting
    if (!validateCurrentStep()) {
      toast.error('Please fill all required fields correctly')
      return
    }
    
    setIsUploading(true)
    
    try {
      let uploadedDocUrls = {}
      
      // If seller, upload documents first
      if (formData.role === 'seller') {
        toast.loading('Uploading documents...', { id: 'upload' })
        
        // Upload ID document
        if (uploadedFiles.idDocument) {
          const idDocUrl = await uploadFileToCloud(uploadedFiles.idDocument, 'seller-documents/id-docs')
          if (idDocUrl) {
            uploadedDocUrls.idDocument = idDocUrl
          }
        }
        
        // Upload business documents if any
        if (uploadedFiles.businessDocuments && uploadedFiles.businessDocuments.length > 0) {
          const businessDocUrls = []
          for (const doc of uploadedFiles.businessDocuments) {
            const docUrl = await uploadFileToCloud(doc, 'seller-documents/business-docs')
            if (docUrl) businessDocUrls.push(docUrl)
          }
          if (businessDocUrls.length > 0) {
            uploadedDocUrls.businessDocuments = businessDocUrls.join(',')
          }
        }
        
        // Upload cover photo if any
        if (uploadedFiles.coverPhoto) {
          const coverUrl = await uploadFileToCloud(uploadedFiles.coverPhoto, 'seller-covers')
          if (coverUrl) {
            uploadedDocUrls.coverPhoto = coverUrl
          }
        }
        
        toast.success('Documents uploaded!', { id: 'upload' })
      }
      
      // Register with Supabase Auth (works for both buyers and sellers)
      const result = await register(
        formData.email,
        formData.password,
        formData.name,
        formData.role,
        formData.city,
        formData.address,
        formData.businessName,
        formData.description,
        formData.address.phone,
        uploadedDocUrls.idDocument || 'pending',
        {
          idType: formData.idType,
          idNumber: formData.idNumber,
          instagram: formData.instagram || null,
          facebook: formData.facebook || null,
          x: formData.x || null,
          linkedin: formData.linkedin || null,
          businessAddress: formData.businessAddress,
          accountHolderName: formData.accountHolderName,
          accountNumber: formData.bankAccountNumber,
          ifscCode: formData.ifscCode,
          businessDocument: uploadedDocUrls.businessDocuments,
          coverPhoto: uploadedDocUrls.coverPhoto,
          username: formData.username
        }
      )
      
      if (result.success) {
        // If OTP verification is required, don't navigate yet
        if (result.requiresOtp) {
          // The OTP modal will be shown via pendingVerification state
          return
        }

        // Wait a bit for user to be synced in auth context
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Seller profile is already created by /api/auth/register
        // No need for separate /api/sellers call anymore
        
        // Get user from auth context to send verification email
        if (user?.id) {
          try {
            const verifyResponse = await fetch('/api/email/send-verification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: formData.email,
                userId: user.id,
                username: formData.name || formData.username
              })
            });

            if (!verifyResponse.ok) {
              console.error('Failed to send verification email');
            }
          } catch (emailError) {
            console.error('Verification email error:', emailError);
          }
        }
        
        // Navigate based on role
        if (formData.role === 'seller') {
          toast.success('Registration successful! Please check your email to verify your account. Your seller account is pending approval.')
          router.push('/seller/dashboard')
        } else {
          toast.success('Registration successful! Please check your email to verify your account.')
          router.push('/')
        }
      }
    } catch (error) {
      console.error('Registration error:', error)
      setErrors(prev => ({ ...prev, submit: error.message || 'Registration failed. Please try again.' }))
    } finally {
      setIsUploading(false)
    }
  }

  // --- OTP Verification ---
  const handleVerificationSuccess = async () => {
    // Save address to AddressContext if we have one and user is logged in
    // Note: Address is already saved in buyer record during registration
    // This is just to add it to the addresses table for easier access
    if (formData.address && formData.address.fullName && user?.id) {
      try {
        // Wait a bit for user to be fully synced
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        const result = await addAddress({
          name: formData.address.fullName,
          phone: formData.address.phone,
          address: formData.address.address,
          city: formData.address.city,
          state: formData.address.state,
          pincode: formData.address.pincode,
          isDefault: true
        })
        
        if (!result) {
          // Address saving failed, but that's okay - it's already in buyer record
          console.log('Address not saved to addresses table, but it exists in buyer record')
        }
      } catch (error) {
        // Non-critical error - address is already in buyer record
        console.log('Address saving skipped:', error.message)
      }
    }
    
    if (formData.role === 'seller') router.push('/seller/dashboard')
    else router.push('/')
  }

  const handleAddressDetected = (addressData) => {
    setFormData(prev => ({
      ...prev,
      city: addressData.city,
      address: {
        ...prev.address,
        city: addressData.city,
        state: addressData.state,
        pincode: addressData.pincode
      }
    }))
  }
  const handleBackFromOtp = () => setCurrentStep(1)

  // --- Step Indicator ---
  const renderStepIndicator = () => {
    const totalSteps = formData.role === 'seller' ? 4 : 2
    const steps = [
      { number: 1, label: 'Basic Info' },
      { number: 2, label: 'Address' },
      ...(formData.role === 'seller' ? [
        { number: 3, label: 'Business Info' },
        { number: 4, label: 'Verification' }
      ] : [])
    ]
    
    return (
      <div className="flex items-center justify-center space-x-4 mb-8">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              currentStep >= step.number 
                ? 'bg-primary-600 text-white' 
                : 'bg-gray-200 text-gray-600'
            }`}>
              {step.number}
            </div>
            <span className={`ml-2 text-sm font-medium ${
              currentStep >= step.number ? 'text-primary-600' : 'text-gray-500'
            }`}>
              {step.label}
            </span>
            {index < steps.length - 1 && (
              <div className={`w-12 h-0.5 mx-4 ${
                currentStep > step.number ? 'bg-primary-600' : 'bg-gray-200'
              }`} />
            )}
          </div>
        ))}
      </div>
    )
  }

  // --- OTP Modal ---
  if (pendingVerification) {
    return (
      <OtpVerification
        email={pendingVerification.email}
        userType={pendingVerification.userType}
        onVerificationSuccess={handleVerificationSuccess}
        onBack={handleBackFromOtp}
      />
    )
  }

  // --- Step 1 ---
  const renderStep1 = () => (
    <div className="space-y-6">
      {/* Role Selection */}
      {/* NOTE: Admin registration is NOT allowed - Admin accounts can only be created via SQL script (create-admin.sql) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">I want to join as:</label>
        <div className="grid grid-cols-2 gap-4">
          <label className="relative">
            <input type="radio" name="role" value="buyer" checked={formData.role === 'buyer'} onChange={handleInputChange} className="sr-only" />
            <div className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${formData.role === 'buyer' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <div className="text-center">
                <User className="w-8 h-8 mx-auto mb-2 text-primary-600" />
                <h3 className="font-semibold">Buyer</h3>
                <p className="text-sm text-gray-600">Discover and purchase unique gifts</p>
              </div>
            </div>
          </label>
          <label className="relative">
            <input type="radio" name="role" value="seller" checked={formData.role === 'seller'} onChange={handleInputChange} className="sr-only" />
            <div className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${formData.role === 'seller' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <div className="text-center">
                <Building className="w-8 h-8 mx-auto mb-2 text-primary-600" />
                <h3 className="font-semibold">Seller</h3>
                <p className="text-sm text-gray-600">Share your creations with the world</p>
              </div>
            </div>
          </label>
        </div>
      </div>
      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><User className="h-5 w-5 text-gray-400" /></div>
            <input id="name" name="name" type="text" value={formData.name} onChange={handleInputChange} className={`block w-full pl-10 pr-3 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${errors.name ? 'border-red-300' : 'border-gray-300'}`} placeholder="Enter your full name" />
          </div>
          {errors.name && (<p className="mt-1 text-sm text-red-600">{errors.name}</p>)}
        </div>
        <div>
          <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">City</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><MapPin className="h-5 w-5 text-gray-400" /></div>
            <select id="city" name="city" value={formData.city} onChange={handleInputChange} className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors">
              {cities.map(city => (<option key={city} value={city}>{city}</option>))}
            </select>
          </div>
        </div>
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Mail className="h-5 w-5 text-gray-400" /></div>
          <input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} className={`block w-full pl-10 pr-3 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${errors.email ? 'border-red-300' : 'border-gray-300'}`} placeholder="Enter your email" />
        </div>
        {errors.email && (<p className="mt-1 text-sm text-red-600">{errors.email}</p>)}
      </div>
      {/* Password Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">Password</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock className="h-5 w-5 text-gray-400" /></div>
            <input id="password" name="password" type={showPassword ? 'text' : 'password'} value={formData.password} onChange={handleInputChange} className={`block w-full pl-10 pr-10 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${errors.password ? 'border-red-300' : 'border-gray-300'}`} placeholder="Enter your password" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center">{showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}</button>
          </div>
          {errors.password && (<p className="mt-1 text-sm text-red-600">{errors.password}</p>)}
        </div>
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock className="h-5 w-5 text-gray-400" /></div>
            <input id="confirmPassword" name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} value={formData.confirmPassword} onChange={handleInputChange} className={`block w-full pl-10 pr-10 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${errors.confirmPassword ? 'border-red-300' : 'border-gray-300'}`} placeholder="Confirm your password" />
            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center">{showConfirmPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}</button>
          </div>
          {errors.confirmPassword && (<p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>)}
        </div>
      </div>
      {/* Terms and Conditions */}
      <div className="space-y-4">
        <div className="flex items-start space-x-3">
          <input id="acceptTerms" name="acceptTerms" type="checkbox" checked={formData.acceptTerms} onChange={handleInputChange} className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded" />
          <label htmlFor="acceptTerms" className="text-sm text-gray-700">I agree to the <Link href="/terms" className="text-primary-600 hover:text-primary-700">Terms and Conditions</Link></label>
        </div>
        {errors.acceptTerms && (<p className="text-sm text-red-600">{errors.acceptTerms}</p>)}
        <div className="flex items-start space-x-3">
          <input id="acceptPrivacyPolicy" name="acceptPrivacyPolicy" type="checkbox" checked={formData.acceptPrivacyPolicy} onChange={handleInputChange} className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded" />
          <label htmlFor="acceptPrivacyPolicy" className="text-sm text-gray-700">I agree to the <Link href="/privacy" className="text-primary-600 hover:text-primary-700">Privacy Policy</Link></label>
        </div>
        {errors.acceptPrivacyPolicy && (<p className="text-sm text-red-600">{errors.acceptPrivacyPolicy}</p>)}
        {formData.role === 'seller' && (
          <div className="flex items-start space-x-3">
            <input id="acceptSellerAgreement" name="acceptSellerAgreement" type="checkbox" checked={formData.acceptSellerAgreement} onChange={handleInputChange} className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded" />
            <label htmlFor="acceptSellerAgreement" className="text-sm text-gray-700">I agree to the <Link href="/seller-agreement" className="text-primary-600 hover:text-primary-700">Seller Agreement</Link></label>
          </div>
        )}
        {errors.acceptSellerAgreement && (<p className="text-sm text-red-600">{errors.acceptSellerAgreement}</p>)}
      </div>
    </div>
  )

  // --- Step 2: Address Collection ---
  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <div className="flex items-center space-x-2">
          <MapPin className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-blue-700">Delivery Address</h3>
        </div>
        <p className="text-sm text-blue-600 mt-1">
          Add your delivery address to ensure smooth order processing and accurate delivery estimates.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="address.phone" className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Phone className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="address.phone"
              name="address.phone"
              type="tel"
              value={formData.address.phone}
              onChange={handleInputChange}
              className={`block w-full pl-10 pr-3 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
                errors['address.phone'] ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Enter phone number"
            />
          </div>
          {errors['address.phone'] && (
            <p className="mt-1 text-sm text-red-600">{errors['address.phone']}</p>
          )}
        </div>
      </div>
      
      <div>
        <label htmlFor="address.address" className="block text-sm font-medium text-gray-700 mb-2">
          Complete Address *
        </label>
        <textarea
          id="address.address"
          name="address.address"
          value={formData.address.address}
          onChange={handleInputChange}
          rows="3"
          className={`block w-full px-3 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
            errors['address.address'] ? 'border-red-300' : 'border-gray-300'
          }`}
          placeholder="Enter your complete address (street, area, landmark)"
        />
        {errors['address.address'] && (
          <p className="mt-1 text-sm text-red-600">{errors['address.address']}</p>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="address.city" className="block text-sm font-medium text-gray-700 mb-2">
            City *
          </label>
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MapPin className="h-5 w-5 text-gray-400" />
              </div>
              <select
                id="address.city"
                name="address.city"
                value={formData.address.city}
                onChange={handleInputChange}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
              >
                {cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setShowAddressModal(true)}
              className="px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl flex items-center space-x-2 transition-colors"
            >
              <Navigation2 className="w-4 h-4" />
              <span className="text-sm">Auto Detect</span>
            </button>
          </div>
          {errors['address.city'] && (
            <p className="mt-1 text-sm text-red-600">{errors['address.city']}</p>
          )}
        </div>
        
        <div>
          <label htmlFor="address.state" className="block text-sm font-medium text-gray-700 mb-2">
            State
          </label>
          <input
            id="address.state"
            name="address.state"
            type="text"
            value={formData.address.state}
            onChange={handleInputChange}
            className="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
            placeholder="Enter state"
          />
        </div>
        
        <div>
          <label htmlFor="address.pincode" className="block text-sm font-medium text-gray-700 mb-2">
            Pincode *
          </label>
          <input
            id="address.pincode"
            name="address.pincode"
            type="text"
            value={formData.address.pincode}
            onChange={handleInputChange}
            className={`block w-full px-3 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
              errors['address.pincode'] ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Enter 6-digit pincode"
            maxLength="6"
          />
          {errors['address.pincode'] && (
            <p className="mt-1 text-sm text-red-600">{errors['address.pincode']}</p>
          )}
        </div>
      </div>
      
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-center space-x-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-sm font-medium text-green-700">Default Address</span>
        </div>
        <p className="text-sm text-green-600 mt-1">
          This will be set as your default delivery address. You can add more addresses later from your profile.
        </p>
      </div>
    </div>
  )

  // --- Step 3: Business Information (Sellers Only) ---
  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-amber-600" />
          <h3 className="text-lg font-semibold text-amber-700">Business Information</h3>
        </div>
        <p className="text-sm text-amber-600 mt-1">
          Tell us about your business to help customers discover your products.
        </p>
      </div>
      
      <div>
        <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-2">
          Business Name *
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Building className="h-5 w-5 text-gray-400" />
          </div>
          <input
            id="businessName"
            name="businessName"
            type="text"
            value={formData.businessName}
            onChange={handleInputChange}
            className={`block w-full pl-10 pr-3 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
              errors.businessName ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Enter your business name"
          />
        </div>
        {errors.businessName && (
          <p className="mt-1 text-sm text-red-600">{errors.businessName}</p>
        )}
      </div>
      
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
          Username * <span className="text-gray-500 text-xs">(This will be your shop URL)</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <User className="h-5 w-5 text-gray-400" />
          </div>
          <input
            id="username"
            name="username"
            type="text"
            value={formData.username}
            onChange={handleInputChange}
            className={`block w-full pl-10 pr-3 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
              errors.username ? 'border-red-300' : usernameAvailable === true ? 'border-green-300' : 'border-gray-300'
            }`}
            placeholder="your-username"
          />
          {checkingUsername && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
            </div>
          )}
          {!checkingUsername && usernameAvailable === true && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
          )}
          {!checkingUsername && usernameAvailable === false && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
          )}
        </div>
        {!errors.username && usernameAvailable === true && (
          <p className="mt-1 text-sm text-green-600 flex items-center gap-1">
            <CheckCircle className="w-4 h-4" /> Username is available!
          </p>
        )}
        {errors.username && (
          <p className="mt-1 text-sm text-red-600">{errors.username}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Only lowercase letters, numbers, hyphens, and underscores. Min 3 characters.
        </p>
      </div>
      

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
          Business Description *
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          value={formData.description}
          onChange={handleInputChange}
          className={`block w-full px-3 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
            errors.description ? 'border-red-300' : 'border-gray-300'
          }`}
          placeholder="Tell us about your business, products, and what makes you unique..."
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description}</p>
        )}
      </div>
      
      <div>
        <label htmlFor="businessAddress" className="block text-sm font-medium text-gray-700 mb-2">
          Business Address *
        </label>
        <textarea
          id="businessAddress"
          name="businessAddress"
          rows={3}
          value={formData.businessAddress}
          onChange={handleInputChange}
          className={`block w-full px-3 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
            errors.businessAddress ? 'border-red-300' : 'border-gray-300'
          }`}
          placeholder="Enter your complete business address"
        />
        {errors.businessAddress && (
          <p className="mt-1 text-sm text-red-600">{errors.businessAddress}</p>
        )}
      </div>
    </div>
  )

  // --- Step 4 ---
  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
        <div className="flex items-center space-x-2"><AlertCircle className="w-5 h-5 text-amber-600" /><h3 className="text-lg font-semibold text-amber-700">Verification Required</h3></div>
        <p className="text-sm text-amber-600 mt-1">This information helps us verify your identity and ensure a secure marketplace for all users.</p>
      </div>
      {/* ID Verification */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="idType" className="block text-sm font-medium text-gray-700 mb-2">ID Type *</label>
          <select id="idType" name="idType" value={formData.idType} onChange={handleInputChange} className="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors">
            {idTypes.map(type => (<option key={type.value} value={type.value}>{type.label}</option>))}
          </select>
        </div>
        <div>
          <label htmlFor="idNumber" className="block text-sm font-medium text-gray-700 mb-2">ID Number *</label>
          <input id="idNumber" name="idNumber" type="text" value={formData.idNumber} onChange={handleInputChange} className={`block w-full px-3 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${errors.idNumber ? 'border-red-300' : 'border-gray-300'}`} placeholder="Enter your ID number" />
          {errors.idNumber && (<p className="mt-1 text-sm text-red-600">{errors.idNumber}</p>)}
        </div>
      </div>
      {/* ID Document Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Upload ID Document *</label>
        <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${isDragOver ? 'border-primary-500 bg-primary-50' : errors.idDocument ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-gray-400'}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={e => handleDrop(e, 'idDocument')}>
          {uploadedFiles.idDocument ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center space-x-2 text-primary-600">{getFileIcon(uploadedFiles.idDocument.type)}<span className="font-medium">{uploadedFiles.idDocument.name}</span></div>
              {/* Show image preview if file is an image */}
              {uploadedFiles.idDocument.type && uploadedFiles.idDocument.type.startsWith('image/') && (
                <img
                  src={URL.createObjectURL(uploadedFiles.idDocument)}
                  alt="ID Preview"
                  className="mx-auto rounded-lg border border-gray-200 max-h-40"
                  style={{ maxWidth: 200, objectFit: 'contain' }}
                />
              )}
              <p className="text-sm text-gray-600">Size: {formatFileSize(uploadedFiles.idDocument.size)}</p>
              <button type="button" onClick={() => removeFile('idDocument')} className="inline-flex items-center space-x-1 text-red-600 hover:text-red-700 text-sm"><X className="w-4 h-4" /><span>Remove</span></button>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload className="w-12 h-12 mx-auto text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">Drag and drop your ID document here, or{' '}<label className="text-primary-600 hover:text-primary-700 cursor-pointer">browse<input type="file" className="hidden" accept="image/*,.pdf" onChange={e => handleFileInput(e, 'idDocument')} /></label></p>
                <p className="text-xs text-gray-500 mt-1">Supported formats: JPEG, PNG, PDF (Max 5MB)</p>
              </div>
            </div>
          )}
        </div>
        {errors.idDocument && (<p className="mt-1 text-sm text-red-600">{errors.idDocument}</p>)}
      </div>
      {/* Bank Details */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <h4 className="text-md font-semibold text-gray-700 mb-4">Bank Account Details (for payments) *</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="accountHolderName" className="block text-sm font-medium text-gray-700 mb-2">Account Holder Name *</label>
            <input id="accountHolderName" name="accountHolderName" type="text" value={formData.accountHolderName} onChange={handleInputChange} className={`block w-full px-3 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${errors.accountHolderName ? 'border-red-300' : 'border-gray-300'}`} placeholder="Name as per bank records" />
            {errors.accountHolderName && (<p className="mt-1 text-sm text-red-600">{errors.accountHolderName}</p>)}
          </div>
          <div>
            <label htmlFor="bankAccountNumber" className="block text-sm font-medium text-gray-700 mb-2">Account Number *</label>
            <input id="bankAccountNumber" name="bankAccountNumber" type="text" value={formData.bankAccountNumber} onChange={handleInputChange} className={`block w-full px-3 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${errors.bankAccountNumber ? 'border-red-300' : 'border-gray-300'}`} placeholder="Bank account number" />
            {errors.bankAccountNumber && (<p className="mt-1 text-sm text-red-600">{errors.bankAccountNumber}</p>)}
          </div>
          <div>
            <label htmlFor="ifscCode" className="block text-sm font-medium text-gray-700 mb-2">IFSC Code *</label>
            <input id="ifscCode" name="ifscCode" type="text" value={formData.ifscCode} onChange={handleInputChange} className={`block w-full px-3 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${errors.ifscCode ? 'border-red-300' : 'border-gray-300'}`} placeholder="e.g., SBIN0001234" />
            {errors.ifscCode && (<p className="mt-1 text-sm text-red-600">{errors.ifscCode}</p>)}
          </div>
        </div>
      </div>
      {/* Social Media Links */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Social Media (At least one required) *</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="instagram" className="block text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
              <Instagram className="h-4 w-4 text-pink-500" />
              Instagram
            </label>
            <input
              id="instagram"
              name="instagram"
              type="text"
              value={formData.instagram}
              onChange={handleInputChange}
              className="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
              placeholder="@your_handle or full URL"
            />
          </div>
          <div>
            <label htmlFor="facebook" className="block text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
              <Facebook className="h-4 w-4 text-blue-600" />
              Facebook
            </label>
            <input
              id="facebook"
              name="facebook"
              type="text"
              value={formData.facebook}
              onChange={handleInputChange}
              className="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
              placeholder="facebook.com/yourpage"
            />
          </div>
          <div>
            <label htmlFor="x" className="block text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
              <Twitter className="h-4 w-4 text-gray-900" />
              X (Twitter)
            </label>
            <input
              id="x"
              name="x"
              type="text"
              value={formData.x}
              onChange={handleInputChange}
              className="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
              placeholder="@your_handle or full URL"
            />
          </div>
          <div>
            <label htmlFor="linkedin" className="block text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
              <Linkedin className="h-4 w-4 text-blue-700" />
              LinkedIn
            </label>
            <input
              id="linkedin"
              name="linkedin"
              type="text"
              value={formData.linkedin}
              onChange={handleInputChange}
              className="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
              placeholder="linkedin.com/in/yourprofile"
            />
          </div>
        </div>
        {errors.socialMedia && (<p className="mt-1 text-sm text-red-600">{errors.socialMedia}</p>)}
      </div>
    </div>
  )

  // --- Main Render ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 py-12 px-4 sm:px-6 lg:px-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="bg-primary-600 p-3 rounded-xl"><Sparkles className="w-8 h-8 text-white" /></div>
            <span className="text-3xl font-bold text-primary-700 font-serif">Zaryah</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Join Our Community</h2>
          <p className="mt-2 text-gray-600">Create your account and start your journey with meaningful gifts</p>
        </div>
        {/* Step Indicator */}
        {renderStepIndicator()}
        {/* Form */}
        <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="bg-white p-8 rounded-2xl shadow-xl space-y-6" onSubmit={handleSubmit}>
          {/* Render current step */}
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
          {/* Navigation Buttons */}
          <div className="flex justify-between pt-6">
            {currentStep > 1 ? (
              <motion.button 
                whileHover={{ scale: 1.02 }} 
                whileTap={{ scale: 0.98 }} 
                type="button" 
                onClick={prevStep} 
                className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-6 rounded-xl font-semibold transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Previous</span>
              </motion.button>
            ) : (
              <div></div>
            )}
            
            {((formData.role === 'buyer' && currentStep === 2) || 
              (formData.role === 'seller' && currentStep === 4)) ? (
              <motion.button 
                whileHover={{ scale: 1.02 }} 
                whileTap={{ scale: 0.98 }} 
                type="submit" 
                disabled={isLoading || isUploading} 
                className="flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white py-3 px-6 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{isUploading ? 'Uploading...' : 'Create Account'}</span>
              </motion.button>
            ) : (
              <motion.button 
                whileHover={{ scale: 1.02 }} 
                whileTap={{ scale: 0.98 }} 
                type="button" 
                onClick={nextStep} 
                disabled={isLoading || isUploading} 
                className="flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white py-3 px-6 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Next Step</span>
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            )}
          </div>
          {/* Error on submit */}
          {errors.submit && <p className="text-center text-red-600 mt-2">{errors.submit}</p>}
          {/* Links */}
          <div className="text-center pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">Already have an account?{' '}<Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">Sign in here</Link></p>
          </div>
        </motion.form>
      </motion.div>
      
      {/* Address Detection Modal */}
      <AddressDetectionModal
        isOpen={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        onAddressDetected={handleAddressDetected}
      />
    </div>
  )
}
