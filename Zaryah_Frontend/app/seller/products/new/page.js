'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/contexts/AuthContext'
import { supabaseClient } from '@/lib/supabase-client'
import { 
  Package, 
  Upload, 
  X, 
  Image as ImageIcon, 
  Plus, 
  Trash2,
  ArrowLeft,
  Save
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function AddProductPage() {
  const router = useRouter()
  const { user } = useAuth()
  const fileInputRef = useRef(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    mrp: '',
    category: '',
    section: '',
    weight: '',
    stock: '',
    customisable: false,
    deliveryTimeMin: '',
    deliveryTimeMax: '',
    deliveryTimeUnit: 'days',
    instantDelivery: false,
    material: '',
    careInstructions: '',
    returnAvailable: true,
    exchangeAvailable: true,
    returnDays: '7',
    codAvailable: true,
    legalDisclaimer: '',
    sizeOptions: ''
  })

  const [images, setImages] = useState([])
  const [features, setFeatures] = useState([''])
  const [customQuestions, setCustomQuestions] = useState([{ question: '', required: false }])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  const categories = [
    'Resin Art',
    'Crochet',
    'Pottery',
    'Jewelry',
    'Candles',
    'Home Decor',
    'Paper Crafts',
    'Embroidery',
    'Painting',
    'Soap Making',
    'For Him',
    'For Her', 
    'For Kids',
    'Personalized Gifts',
    'Sweets',
    'Snacks',
    'Beverages',
    'Gift Hampers',
    'Other'
  ]

  const sections = [
    'Featured', 'Trending', 'New Arrivals', 'Best Sellers', 'None'
  ]

  const fillDemoData = () => {
    setFormData({
      name: 'Artisan Chocolate Gift Box',
      description: 'Premium handcrafted chocolates made with organic ingredients. Perfect for gifting on special occasions. Each piece is carefully crafted by our expert chocolatiers using traditional methods.',
      price: '899',
      mrp: '1099',
      category: 'Sweets',
      section: 'Featured',
      weight: '500',
      stock: '25',
      customisable: true,
      deliveryTimeMin: '2',
      deliveryTimeMax: '5',
      deliveryTimeUnit: 'days',
      instantDelivery: false,
      material: 'Premium milk chocolate with organic ingredients',
      careInstructions: 'Store in a cool, dry place away from sunlight. Best consumed within 30 days of opening.',
      returnAvailable: false,
      exchangeAvailable: true,
      returnDays: '0',
      codAvailable: true,
      legalDisclaimer: 'Actual product packaging may contain more information. Please read labels carefully before consuming.',
      sizeOptions: 'Pack'
    })
    
    setFeatures([
      'Sugar-free option available',
      'Organic cocoa beans',
      'Handmade with love',
      'Beautiful gift packaging included'
    ])
    
    setCustomQuestions([
      { question: 'Any dietary restrictions?', required: false },
      { question: 'Message for the card?', required: true }
    ])
    
    toast.success('Demo data filled!')
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files)
    const validFiles = files.filter(file => {
      const isValidType = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)
      const isValidSize = file.size <= 5 * 1024 * 1024 // 5MB limit
      
      if (!isValidType) {
        toast.error(`${file.name} is not a valid image format`)
        return false
      }
      if (!isValidSize) {
        toast.error(`${file.name} exceeds 5MB limit`)
        return false
      }
      return true
    })

    setImages(prev => [...prev, ...validFiles].slice(0, 5)) // Max 5 images
  }

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleFeatureChange = (index, value) => {
    const newFeatures = [...features]
    newFeatures[index] = value
    setFeatures(newFeatures)
  }

  const addFeature = () => {
    setFeatures([...features, ''])
  }

  const removeFeature = (index) => {
    setFeatures(features.filter((_, i) => i !== index))
  }

  const handleQuestionChange = (index, field, value) => {
    const newQuestions = [...customQuestions]
    newQuestions[index][field] = value
    setCustomQuestions(newQuestions)
  }

  const addCustomQuestion = () => {
    setCustomQuestions([...customQuestions, { question: '', required: false }])
  }

  const removeCustomQuestion = (index) => {
    setCustomQuestions(customQuestions.filter((_, i) => i !== index))
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.name.trim()) newErrors.name = 'Product name is required'
    if (!formData.description.trim()) newErrors.description = 'Description is required'
    if (!formData.price || parseFloat(formData.price) <= 0) newErrors.price = 'Valid price is required'
    if (!formData.mrp || parseFloat(formData.mrp) <= 0) newErrors.mrp = 'Valid MRP is required'
    if (parseFloat(formData.price) > parseFloat(formData.mrp)) newErrors.price = 'Price cannot be greater than MRP'
    if (!formData.category) newErrors.category = 'Category is required'
    if (!formData.weight || parseFloat(formData.weight) <= 0) newErrors.weight = 'Valid weight is required'
    if (!formData.stock || parseInt(formData.stock) < 0) newErrors.stock = 'Valid stock is required'
    if (!formData.deliveryTimeMin || parseInt(formData.deliveryTimeMin) <= 0) newErrors.deliveryTimeMin = 'Min delivery time required'
    if (!formData.deliveryTimeMax || parseInt(formData.deliveryTimeMax) <= 0) newErrors.deliveryTimeMax = 'Max delivery time required'
    if (parseInt(formData.deliveryTimeMin) > parseInt(formData.deliveryTimeMax)) {
      newErrors.deliveryTimeMax = 'Max time must be greater than min time'
    }
    if (images.length === 0) newErrors.images = 'At least one image is required'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validate()) {
      toast.error('Please fix the errors in the form')
      return
    }

    setLoading(true)
    const toastId = toast.loading('Creating product...')

    try {
      const formDataToSend = new FormData()

      // Basic fields
      Object.keys(formData).forEach(key => {
        formDataToSend.append(key, formData[key])
      })

      // Images
      images.forEach(image => {
        formDataToSend.append('images', image)
      })

      // Features (filter empty)
      const validFeatures = features.filter(f => f.trim())
      if (validFeatures.length > 0) {
        formDataToSend.append('features', JSON.stringify(validFeatures))
      }

      // Custom questions (filter empty)
      const validQuestions = customQuestions.filter(q => q.question.trim())
      if (validQuestions.length > 0) {
        formDataToSend.append('customQuestions', JSON.stringify(validQuestions))
      }

      // Get auth token from Supabase
      const { data: { session } } = await supabaseClient.auth.getSession()
      const token = session?.access_token

      if (!token) {
        throw new Error('You must be logged in to create products')
      }

      const response = await fetch('/api/products', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataToSend
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to create product')
      }

      toast.success('Product created successfully!', { id: toastId })
      router.push('/seller/dashboard')
    } catch (error) {
      console.error('Error creating product:', error)
      toast.error(error.message, { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Add New Product</h1>
              <p className="text-gray-600 mt-2">Create a new product listing for your store</p>
            </div>
            <button
              onClick={fillDemoData}
              type="button"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
            >
              <Package className="w-4 h-4" />
              <span>Fill Demo Data</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border ${errors.name ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
                  placeholder="e.g., Handmade Chocolate Gift Box"
                />
                {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="4"
                  className={`w-full px-4 py-2 border ${errors.description ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
                  placeholder="Describe your product in detail..."
                />
                {errors.description && <p className="text-sm text-red-600 mt-1">{errors.description}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    className={`w-full px-4 py-2 border ${errors.price ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
                    placeholder="0.00"
                  />
                  {errors.price && <p className="text-sm text-red-600 mt-1">{errors.price}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 border ${errors.category ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
                  >
                    <option value="">Select category</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  {errors.category && <p className="text-sm text-red-600 mt-1">{errors.category}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Weight (grams) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="weight"
                    value={formData.weight}
                    onChange={handleInputChange}
                    min="0"
                    className={`w-full px-4 py-2 border ${errors.weight ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
                    placeholder="500"
                  />
                  {errors.weight && <p className="text-sm text-red-600 mt-1">{errors.weight}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stock Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="stock"
                    value={formData.stock}
                    onChange={handleInputChange}
                    min="0"
                    className={`w-full px-4 py-2 border ${errors.stock ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
                    placeholder="100"
                  />
                  {errors.stock && <p className="text-sm text-red-600 mt-1">{errors.stock}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Section</label>
                <select
                  name="section"
                  value={formData.section}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select section (optional)</option>
                  {sections.map(sec => (
                    <option key={sec} value={sec}>{sec}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Images */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Product Images</h2>
            
            <div className="space-y-4">
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={images.length >= 5}
                  className={`w-full px-4 py-8 border-2 border-dashed ${errors.images ? 'border-red-500' : 'border-gray-300'} rounded-lg hover:border-primary-500 transition-colors flex flex-col items-center justify-center space-y-2 ${images.length >= 5 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Upload className="w-8 h-8 text-gray-400" />
                  <p className="text-sm text-gray-600">
                    {images.length >= 5 ? 'Maximum 5 images' : 'Click to upload images'}
                  </p>
                  <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB</p>
                </button>
                {errors.images && <p className="text-sm text-red-600 mt-1">{errors.images}</p>}
              </div>

              {images.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {images.map((image, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                        <img
                          src={URL.createObjectURL(image)}
                          alt={`Product ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      {index === 0 && (
                        <span className="absolute bottom-2 left-2 bg-primary-600 text-white text-xs px-2 py-1 rounded">
                          Primary
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Delivery Options */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Delivery Options</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Min Delivery Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="deliveryTimeMin"
                    value={formData.deliveryTimeMin}
                    onChange={handleInputChange}
                    min="0"
                    className={`w-full px-4 py-2 border ${errors.deliveryTimeMin ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
                  />
                  {errors.deliveryTimeMin && <p className="text-sm text-red-600 mt-1">{errors.deliveryTimeMin}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Delivery Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="deliveryTimeMax"
                    value={formData.deliveryTimeMax}
                    onChange={handleInputChange}
                    min="0"
                    className={`w-full px-4 py-2 border ${errors.deliveryTimeMax ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
                  />
                  {errors.deliveryTimeMax && <p className="text-sm text-red-600 mt-1">{errors.deliveryTimeMax}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
                  <select
                    name="deliveryTimeUnit"
                    value={formData.deliveryTimeUnit}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="instantDelivery"
                    checked={formData.instantDelivery}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">Instant Delivery Available</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="customisable"
                    checked={formData.customisable}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">Customisable Product</span>
                </label>
              </div>
            </div>
          </div>

          {/* Additional Details */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Additional Details</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    MRP (Maximum Retail Price) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="mrp"
                    value={formData.mrp}
                    onChange={handleInputChange}
                    placeholder="1299"
                    min="0"
                    step="0.01"
                    className={`w-full px-4 py-2 border ${errors.mrp ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
                  />
                  {errors.mrp && <p className="text-sm text-red-600 mt-1">{errors.mrp}</p>}
                  <p className="text-xs text-gray-500 mt-1">Original price (should be higher than selling price)</p>
                  {formData.price && formData.mrp && parseFloat(formData.mrp) > parseFloat(formData.price) && (
                    <p className="text-xs text-green-600 mt-1 font-medium">
                      Discount: {Math.round(((parseFloat(formData.mrp) - parseFloat(formData.price)) / parseFloat(formData.mrp)) * 100)}% OFF
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Size Options
                  </label>
                  <input
                    type="text"
                    name="sizeOptions"
                    value={formData.sizeOptions}
                    onChange={handleInputChange}
                    placeholder="e.g., Small, Medium, Large or Pack"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Separate multiple sizes with commas</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Material
                </label>
                <input
                  type="text"
                  name="material"
                  value={formData.material}
                  onChange={handleInputChange}
                  placeholder="e.g., Premium milk chocolate with organic ingredients"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Care Instructions
                </label>
                <textarea
                  name="careInstructions"
                  value={formData.careInstructions}
                  onChange={handleInputChange}
                  placeholder="e.g., Store in a cool, dry place..."
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Policies */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Policies</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Return & Exchange Policy
                </label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="returnPolicy"
                      checked={formData.returnAvailable && formData.exchangeAvailable}
                      onChange={() => setFormData({...formData, returnAvailable: true, exchangeAvailable: true})}
                      className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Return & Exchange Available</span>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="returnPolicy"
                      checked={!formData.returnAvailable && formData.exchangeAvailable}
                      onChange={() => setFormData({...formData, returnAvailable: false, exchangeAvailable: true})}
                      className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Only Exchange, No Return</span>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="returnPolicy"
                      checked={!formData.returnAvailable && !formData.exchangeAvailable}
                      onChange={() => setFormData({...formData, returnAvailable: false, exchangeAvailable: false})}
                      className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                    />
                    <span className="text-sm text-gray-700">No Return or Exchange</span>
                  </label>
                </div>

                {(formData.returnAvailable || formData.exchangeAvailable) && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Within How Many Days?
                    </label>
                    <input
                      type="number"
                      name="returnDays"
                      value={formData.returnDays}
                      onChange={handleInputChange}
                      placeholder="7"
                      min="1"
                      max="30"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Typically 7-14 days</p>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="codAvailable"
                    checked={formData.codAvailable}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">Cash on Delivery (COD) Available</span>
                </label>
              </div>
            </div>
          </div>

          {/* Legal */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Legal Information</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Legal Disclaimer
              </label>
              <textarea
                name="legalDisclaimer"
                value={formData.legalDisclaimer}
                onChange={handleInputChange}
                placeholder="e.g., Actual product packaging may contain more information..."
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Features */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Features</h2>
              <button
                type="button"
                onClick={addFeature}
                className="inline-flex items-center space-x-1 text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                <span>Add Feature</span>
              </button>
            </div>
            
            <div className="space-y-3">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={feature}
                    onChange={(e) => handleFeatureChange(index, e.target.value)}
                    placeholder="e.g., Sugar-free, Organic ingredients"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {features.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeFeature(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Custom Questions */}
          {formData.customisable && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Custom Questions</h2>
                <button
                  type="button"
                  onClick={addCustomQuestion}
                  className="inline-flex items-center space-x-1 text-primary-600 hover:text-primary-700 text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Question</span>
                </button>
              </div>
              
              <div className="space-y-3">
                {customQuestions.map((q, index) => (
                  <div key={index} className="flex items-start space-x-2">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={q.question}
                        onChange={(e) => handleQuestionChange(index, 'question', e.target.value)}
                        placeholder="e.g., What message would you like on the card?"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <label className="flex items-center space-x-2 mt-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={q.required}
                          onChange={(e) => handleQuestionChange(index, 'required', e.target.checked)}
                          className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">Required</span>
                      </label>
                    </div>
                    {customQuestions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCustomQuestion(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex items-center justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              <span>{loading ? 'Creating...' : 'Create Product'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
