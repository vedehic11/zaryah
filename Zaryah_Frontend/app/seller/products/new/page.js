'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/contexts/AuthContext'
import { supabaseClient } from '@/lib/supabase-client'
import { apiService } from '@/app/services/api'
import MultiSelect from '@/app/components/MultiSelect'
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
  const sizeChartInputRefs = useRef({})
  const colorImageInputRefs = useRef({})

  const WORD_LIMITS = {
    name: 12,
    description: 80,
    material: 20,
    careInstructions: 40,
    legalDisclaimer: 40,
    feature: 10,
    question: 20
  }

  const IMAGE_LIMIT = 5

  const countWords = (value) => String(value || '').trim().split(/\s+/).filter(Boolean).length

  const limitWords = (value, limit) => {
    const words = String(value || '').trim().split(/\s+/).filter(Boolean)
    return words.slice(0, limit).join(' ')
  }

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    mrp: '',
    categories: [],
    sections: [],
    weight: '',
    stock: '',
    customisable: false,
    deliveryTimeMin: '',
    deliveryTimeMax: '',
    deliveryTimeUnit: 'days',
    // instantDelivery option removed
    twoWayDelivery: false,
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
  const [imageUploading, setImageUploading] = useState(false)
  const [features, setFeatures] = useState([''])
  const [customQuestions, setCustomQuestions] = useState([{ question: '', required: false, answerType: 'text' }])
  const [sizePriceOptions, setSizePriceOptions] = useState([{ label: '', price: '' }])
  const [colorOptions, setColorOptions] = useState([{ name: '', image: '' }])
  const [colorImageUploading, setColorImageUploading] = useState({})
  const [sizeCharts, setSizeCharts] = useState([])
  const [sizeChartUploading, setSizeChartUploading] = useState({})
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [sectionOptions, setSectionOptions] = useState(['Featured', 'Trending', 'New Arrivals', 'Best Sellers'])
  const [showImportModal, setShowImportModal] = useState(false)
  const [availableProducts, setAvailableProducts] = useState([])
  const [importLoading, setImportLoading] = useState(false)

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

  useEffect(() => {
    if (!user) return

    const loadSections = async () => {
      try {
        const sellerSections = await apiService.getSellerSections()
        const names = (sellerSections || [])
          .map(section => String(section?.name || '').trim())
          .filter(Boolean)

        if (names.length > 0) {
          setSectionOptions(names)

          setFormData(prev => {
            const current = String(prev.section || '').trim()
            if (current && names.includes(current)) return prev
            return {
              ...prev,
              section: names[0]
            }
          })
        }
      } catch (error) {
        // Keep defaults if seller sections cannot be loaded.
        console.error('Failed to load seller sections for add product:', error)
      }
    }

    loadSections()
  }, [user])

  const fetchSellerProducts = async () => {
    try {
      setImportLoading(true)
      const products = await apiService.getProducts({ sellerId: user?.id })
      // Filter out draft products and sort by creation date (newest first)
      const productList = (products || []).filter(p => p.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      setAvailableProducts(productList)
    } catch (error) {
      console.error('Error fetching products:', error)
      toast.error('Failed to load your products')
    } finally {
      setImportLoading(false)
    }
  }

  const handleOpenImportModal = () => {
    if (availableProducts.length === 0) {
      fetchSellerProducts()
    }
    setShowImportModal(true)
  }

  const handleImportFromProduct = (sourceProduct) => {
    // Import basic product information
    setFormData(prev => ({
      ...prev,
      name: sourceProduct.name || '',
      description: sourceProduct.description || '',
      price: sourceProduct.price || '',
      mrp: sourceProduct.mrp || sourceProduct.price || '',
      categories: Array.isArray(sourceProduct.categories)
        ? sourceProduct.categories
        : (sourceProduct.category ? [sourceProduct.category] : []),
      sections: Array.isArray(sourceProduct.sections)
        ? sourceProduct.sections
        : (sourceProduct.section ? [sourceProduct.section] : []),
      weight: sourceProduct.weight || '',
      stock: sourceProduct.stock || '',
      customisable: sourceProduct.customisable || false,
      deliveryTimeMin: sourceProduct.delivery_time_min || sourceProduct.deliveryTimeMin || '',
      deliveryTimeMax: sourceProduct.delivery_time_max || sourceProduct.deliveryTimeMax || '',
      deliveryTimeUnit: sourceProduct.delivery_time_unit || sourceProduct.deliveryTimeUnit || 'days',
      instantDelivery: sourceProduct.instant_delivery || sourceProduct.instantDelivery || false,
      twoWayDelivery: sourceProduct.two_way_delivery || sourceProduct.twoWayDelivery || false,
      material: sourceProduct.material || '',
      careInstructions: sourceProduct.care_instructions || sourceProduct.careInstructions || '',
      returnAvailable: sourceProduct.return_available || sourceProduct.returnAvailable || false,
      exchangeAvailable: sourceProduct.exchange_available || sourceProduct.exchangeAvailable || false,
      returnDays: sourceProduct.return_days || sourceProduct.returnDays || '',
      codAvailable: sourceProduct.cod_available !== undefined ? sourceProduct.cod_available : sourceProduct.codAvailable !== undefined ? sourceProduct.codAvailable : true,
      legalDisclaimer: sourceProduct.legal_disclaimer || sourceProduct.legalDisclaimer || '',
      sizeOptions: sourceProduct.size_options || sourceProduct.sizeOptions || ''
    }))

    // Import reference charts
    if (sourceProduct.size_charts && Array.isArray(sourceProduct.size_charts)) {
      setSizeCharts(sourceProduct.size_charts.map(chart => ({
        label: chart.label || '',
        urls: Array.isArray(chart.urls) ? chart.urls : (chart.url ? [chart.url] : [])
      })))
    } else if (sourceProduct.sizeCharts && Array.isArray(sourceProduct.sizeCharts)) {
      setSizeCharts(sourceProduct.sizeCharts.map(chart => ({
        label: chart.label || '',
        urls: Array.isArray(chart.urls) ? chart.urls : (chart.url ? [chart.url] : [])
      })))
    }

    // Import features
    if (sourceProduct.features && Array.isArray(sourceProduct.features)) {
      setFeatures(sourceProduct.features.filter(f => f && String(f).trim()).slice(0, 10))
    }

    // Import customization questions
    if (sourceProduct.custom_questions && Array.isArray(sourceProduct.custom_questions)) {
      setCustomQuestions(sourceProduct.custom_questions.map(q => ({
        question: q.question || '',
        required: q.required || false,
        answerType: q.answerType || q.type || 'text'
      })))
    } else if (sourceProduct.customQuestions && Array.isArray(sourceProduct.customQuestions)) {
      setCustomQuestions(sourceProduct.customQuestions.map(q => ({
        question: q.question || '',
        required: q.required || false,
        answerType: q.answerType || q.type || 'text'
      })))
    }

    // Import size pricing options
    if (sourceProduct.size_price_options && Array.isArray(sourceProduct.size_price_options)) {
      setSizePriceOptions(sourceProduct.size_price_options.map(o => ({
        label: o.label || '',
        price: o.price || ''
      })))
    } else if (sourceProduct.sizePriceOptions && Array.isArray(sourceProduct.sizePriceOptions)) {
      setSizePriceOptions(sourceProduct.sizePriceOptions.map(o => ({
        label: o.label || '',
        price: o.price || ''
      })))
    }

    // Import color options
    if (sourceProduct.color_options && Array.isArray(sourceProduct.color_options)) {
      setColorOptions(sourceProduct.color_options.map(c => ({
        name: c.name || '',
        image: c.image || ''
      })))
    } else if (sourceProduct.colorOptions && Array.isArray(sourceProduct.colorOptions)) {
      setColorOptions(sourceProduct.colorOptions.map(c => ({
        name: c.name || '',
        image: c.image || ''
      })))
    }

    // Import images
    if (sourceProduct.images && Array.isArray(sourceProduct.images)) {
      setImages(sourceProduct.images.slice(0, 5))
    }

    toast.success(`Imported all info from "${sourceProduct.name}"!`)
    setShowImportModal(false)
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target

    if (type !== 'checkbox' && WORD_LIMITS[name]) {
      setFormData(prev => ({
        ...prev,
        [name]: limitWords(value, WORD_LIMITS[name])
      }))
      return
    }

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

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

    const remainingSlots = Math.max(0, IMAGE_LIMIT - images.length)
    const filesToUpload = validFiles.slice(0, remainingSlots)

    if (filesToUpload.length === 0) {
      toast.error(`Maximum ${IMAGE_LIMIT} images allowed`)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    setImageUploading(true)

    try {
      const uploadedUrls = []

      for (const file of filesToUpload) {
        const uploadData = new FormData()
        uploadData.append('file', file)
        uploadData.append('folder', 'products')

        const response = await apiService.request('/upload', {
          method: 'POST',
          body: uploadData,
          timeoutMs: 120000
        })

        if (!response?.url) {
          throw new Error(`Failed to upload ${file.name}`)
        }

        uploadedUrls.push(response.url)
      }

      setImages(prev => [...prev, ...uploadedUrls].slice(0, 5))
    } catch (error) {
      console.error('Failed to upload product image(s):', error)
      toast.error(error.message || 'Failed to upload image(s)')
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setImageUploading(false)
    }
  }

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleFeatureChange = (index, value) => {
    const limitedValue = limitWords(value, WORD_LIMITS.feature)
    const newFeatures = [...features]
    newFeatures[index] = limitedValue
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
    if (field === 'question') {
      newQuestions[index][field] = limitWords(value, WORD_LIMITS.question)
    } else {
      newQuestions[index][field] = value
    }
    setCustomQuestions(newQuestions)
  }

  const addCustomQuestion = () => {
    setCustomQuestions([...customQuestions, { question: '', required: false, answerType: 'text' }])
  }

  const removeCustomQuestion = (index) => {
    setCustomQuestions(customQuestions.filter((_, i) => i !== index))
  }

  const handleSizePriceChange = (index, field, value) => {
    setSizePriceOptions(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const addSizePriceOption = () => {
    setSizePriceOptions(prev => [...prev, { label: '', price: '' }])
  }

  const removeSizePriceOption = (index) => {
    setSizePriceOptions(prev => prev.filter((_, i) => i !== index))
  }

  const handleColorOptionChange = (index, field, value) => {
    setColorOptions(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const addColorOption = () => {
    setColorOptions(prev => [...prev, { name: '', image: '' }])
  }

  const removeColorOption = (index) => {
    setColorOptions(prev => prev.filter((_, i) => i !== index))
    setColorImageUploading(prev => {
      const next = { ...prev }
      delete next[index]
      return next
    })
  }

  const handleColorImageUpload = async (index, file) => {
    if (!file) return

    const isValidType = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)
    const isValidSize = file.size <= 5 * 1024 * 1024

    if (!isValidType) {
      toast.error('Only JPG, PNG, GIF, or WebP images are allowed')
      return
    }

    if (!isValidSize) {
      toast.error('Image must be 5MB or smaller')
      return
    }

    setColorImageUploading(prev => ({ ...prev, [index]: true }))

    try {
      const uploadData = new FormData()
      uploadData.append('file', file)
      uploadData.append('folder', 'product-color-options')

      const response = await apiService.request('/upload', {
        method: 'POST',
        body: uploadData
      })

      if (!response?.url) {
        throw new Error('Failed to upload image')
      }

      setColorOptions(prev => {
        const updated = [...prev]
        updated[index] = {
          ...updated[index],
          image: response.url
        }
        return updated
      })
      toast.success('Image uploaded')
    } catch (error) {
      toast.error(error.message || 'Failed to upload image')
    } finally {
      setColorImageUploading(prev => ({ ...prev, [index]: false }))
    }
  }

  const handleColorImageRemove = (index) => {
    setColorOptions(prev => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        image: ''
      }
      return updated
    })
  }

  const handleSizeChartUpload = async (index, file) => {
    if (!file) return

    const isValidType = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)
    const isValidSize = file.size <= 5 * 1024 * 1024

    if (!isValidType) {
      toast.error('Only JPG, PNG, GIF, or WebP images are allowed')
      return
    }

    if (!isValidSize) {
      toast.error('Image must be 5MB or smaller')
      return
    }

    setSizeChartUploading(prev => ({ ...prev, [`${index}-upload`]: true }))

    try {
      const uploadData = new FormData()
      uploadData.append('file', file)
      uploadData.append('folder', 'product-size-charts')

      const response = await apiService.request('/upload', {
        method: 'POST',
        body: uploadData
      })

      if (!response?.url) {
        throw new Error('Failed to upload image')
      }

      // Ensure the chart at this index exists and has urls array
      setSizeCharts(prev => {
        const updated = [...prev]
        if (!updated[index]) {
          updated[index] = { label: '', urls: [] }
        }
        if (!Array.isArray(updated[index].urls)) {
          updated[index].urls = []
        }
        // Check if URL already exists to prevent duplicates
        if (!updated[index].urls.includes(response.url)) {
          updated[index].urls.push(response.url)
        }
        return updated
      })
      
      toast.success('Chart image added')
    } catch (error) {
      toast.error(error.message || 'Failed to upload image')
    } finally {
      // Clear the file input value to prevent double-adding
      if (sizeChartInputRefs.current[index]) {
        sizeChartInputRefs.current[index].value = ''
      }
      setSizeChartUploading(prev => ({ ...prev, [`${index}-upload`]: false }))
    }
  }

  const handleRemoveSizeChartImage = (chartIndex, imageIndex) => {
    setSizeCharts(prev => {
      const updated = [...prev]
      updated[chartIndex].urls = updated[chartIndex].urls.filter((_, i) => i !== imageIndex)
      return updated
    })
  }

  const handleSizeChartRemove = (index) => {
    setSizeCharts(prev => prev.filter((_, i) => i !== index))
    setSizeChartUploading(prev => {
      const next = { ...prev }
      delete next[index]
      return next
    })
  }

  const addSizeChart = () => {
    setSizeCharts(prev => [...prev, { label: '', urls: [] }])
  }

  const handleSizeChartLabelChange = (index, value) => {
    setSizeCharts(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], label: value }
      return updated
    })
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.name.trim()) newErrors.name = 'Product name is required'
    if (!formData.description.trim()) newErrors.description = 'Description is required'
    if (!formData.price || parseFloat(formData.price) <= 0) newErrors.price = 'Valid price is required'
    if (!formData.mrp || parseFloat(formData.mrp) <= 0) newErrors.mrp = 'Valid MRP is required'
    if (parseFloat(formData.price) > parseFloat(formData.mrp)) newErrors.price = 'Price cannot be greater than MRP'
    if (formData.categories.length === 0) newErrors.categories = 'At least one category is required'
    if (formData.sections.length === 0) newErrors.sections = 'At least one section is required'
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
      // Normalize delivery unit: convert weeks to days before sending to server
      const normalizedForm = { ...formData }
      if (String(normalizedForm.deliveryTimeUnit || '').toLowerCase() === 'weeks' || String(normalizedForm.deliveryTimeUnit || '').toLowerCase() === 'week') {
        const min = parseInt(normalizedForm.deliveryTimeMin || '0') || 0
        const max = parseInt(normalizedForm.deliveryTimeMax || '0') || 0
        // Convert weeks -> days
        normalizedForm.deliveryTimeMin = String(min * 7)
        normalizedForm.deliveryTimeMax = String(max * 7)
        normalizedForm.deliveryTimeUnit = 'days'
      }

      const formDataToSend = new FormData()

      // Basic fields
      Object.keys(normalizedForm).forEach(key => {
        if (key === 'categories' || key === 'sections') {
          // Send arrays as JSON
          formDataToSend.append(key, JSON.stringify(normalizedForm[key]))
        } else {
          formDataToSend.append(key, normalizedForm[key])
        }
      })

      // Images: keep uploaded files separate from imported image URLs
      const importedImageUrls = images.filter(image => typeof image === 'string')
      images.forEach(image => {
        if (typeof image !== 'string') {
          formDataToSend.append('images', image)
        }
      })

      if (importedImageUrls.length > 0) {
        formDataToSend.append('importedImages', JSON.stringify(importedImageUrls))
      }

      // Features (filter empty)
      const validFeatures = features.filter(f => f.trim())
      if (validFeatures.length > 0) {
        formDataToSend.append('features', JSON.stringify(validFeatures))
      }

      // Custom questions (filter empty)
      const validQuestions = customQuestions
        .filter(q => q.question.trim())
        .map(q => ({
          question: q.question.trim(),
          required: !!q.required,
          answerType: q.answerType || 'text'
        }))
      if (validQuestions.length > 0) {
        formDataToSend.append('customQuestions', JSON.stringify(validQuestions))
      }

      const validSizePriceOptions = sizePriceOptions
        .map(option => ({
          label: String(option.label || '').trim(),
          price: option.price
        }))
        .filter(option => option.label && option.price !== '' && option.price !== null)
        .map(option => ({
          ...option,
          price: parseFloat(option.price)
        }))

      if (validSizePriceOptions.length > 0) {
        formDataToSend.append('sizePriceOptions', JSON.stringify(validSizePriceOptions))
      }

      const validColorOptions = colorOptions
        .map(option => ({
          name: String(option.name || '').trim(),
          image: option.image || ''
        }))
        .filter(option => option.name)

      if (validColorOptions.length > 0) {
        formDataToSend.append('colorOptions', JSON.stringify(validColorOptions))
      }

      // Filter valid size charts (must have label and at least one image URL)
      const validSizeCharts = sizeCharts
        .map(chart => ({
          label: String(chart.label || '').trim(),
          urls: Array.isArray(chart.urls)
            ? chart.urls.map(url => String(url || '').trim()).filter(Boolean)
            : (chart.url ? [String(chart.url || '').trim()] : [])
        }))
        .filter(chart => chart.label && chart.urls.length > 0)

      if (validSizeCharts.length > 0) {
        formDataToSend.append('sizeCharts', JSON.stringify(validSizeCharts))
      }

      // Get auth token from Supabase
      const { data: { session } } = await supabaseClient.auth.getSession()
      const token = session?.access_token

      if (!token) {
        throw new Error('You must be logged in to create products')
      }

      // Add timeout and better progress indication
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 180000) // 3 minute timeout
      
      let response
      try {
        toast.loading(`Uploading images (${images.length} files)...`, { id: toastId })
        
        response = await fetch('/api/products', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formDataToSend,
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
      } catch (fetchError) {
        clearTimeout(timeoutId)
        if (fetchError.name === 'AbortError') {
          throw new Error('Upload took too long (timeout after 3 minutes). Please try with fewer/smaller images.')
        }
        throw fetchError
      }

      toast.loading('Processing product...', { id: toastId })

      // Safely parse response: prefer JSON, but fall back to plain text
      let data = null
      try {
        const contentType = response.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
          data = await response.json()
        } else {
          const text = await response.text()
          data = text
        }
      } catch (parseError) {
        console.error('Failed to parse response body:', parseError)
        const text = await response.text().catch(() => '')
        data = text || null
      }

      if (!response.ok) {
        const errMsg = (data && typeof data === 'object' && (data.error || data.details)) || (typeof data === 'string' && data) || 'Failed to create product'
        throw new Error(errMsg)
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
              onClick={handleOpenImportModal}
              type="button"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <Package className="w-4 h-4" />
              <span>Import from Previous</span>
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
                <p className="text-xs text-gray-500 mt-1">{countWords(formData.description)}/{WORD_LIMITS.description} words</p>
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
                    Categories <span className="text-red-500">*</span>
                  </label>
                  <MultiSelect
                    id="categories"
                    options={categories}
                    selected={formData.categories}
                    onChange={(newCategories) => setFormData(prev => ({ ...prev, categories: newCategories }))}
                    placeholder="Select one or more categories..."
                  />
                  {errors.categories && <p className="text-sm text-red-600 mt-1">{errors.categories}</p>}
                  <p className="text-xs text-gray-500 mt-1">Select multiple categories to reach more buyers</p>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sections <span className="text-red-500">*</span>
                </label>
                <MultiSelect
                  id="sections"
                  options={sectionOptions}
                  selected={formData.sections}
                  onChange={(newSections) => setFormData(prev => ({ ...prev, sections: newSections }))}
                  placeholder="Select one or more sections..."
                />
                {errors.sections && <p className="text-sm text-red-600 mt-1">{errors.sections}</p>}
                <p className="text-xs text-gray-500 mt-1">Products can appear in multiple sections to increase visibility</p>
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
                  disabled={images.length >= IMAGE_LIMIT || imageUploading}
                  className={`w-full px-4 py-8 border-2 border-dashed ${errors.images ? 'border-red-500' : 'border-gray-300'} rounded-lg hover:border-primary-500 transition-colors flex flex-col items-center justify-center space-y-2 ${(images.length >= IMAGE_LIMIT || imageUploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Upload className="w-8 h-8 text-gray-400" />
                  <p className="text-sm text-gray-600">
                    {imageUploading ? 'Uploading images...' : images.length >= IMAGE_LIMIT ? `Maximum ${IMAGE_LIMIT} images` : 'Click to upload images'}
                  </p>
                  <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB each. Up to {IMAGE_LIMIT} images total.</p>
                </button>
                {errors.images && <p className="text-sm text-red-600 mt-1">{errors.images}</p>}
              </div>

              {images.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {images.map((image, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                        <img
                          src={typeof image === 'string' ? image : URL.createObjectURL(image)}
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
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-4">
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
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="twoWayDelivery"
                  checked={formData.twoWayDelivery}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Two-way delivery (buyer sends flowers to you first)</span>
              </label>
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
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Size Pricing
                  </label>
                  <button
                    type="button"
                    onClick={addSizePriceOption}
                    className="inline-flex items-center space-x-1 text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Size</span>
                  </button>
                </div>
                <div className="space-y-3">
                  {sizePriceOptions.map((option, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-3 items-center">
                      <input
                        type="text"
                        value={option.label}
                        onChange={(e) => handleSizePriceChange(index, 'label', e.target.value)}
                        placeholder="e.g., Small or 250g"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <input
                        type="number"
                        value={option.price}
                        onChange={(e) => handleSizePriceChange(index, 'price', e.target.value)}
                        placeholder="Price"
                        min="0"
                        step="0.01"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      {sizePriceOptions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSizePriceOption(index)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">Use the same price for multiple sizes if needed.</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Reference Charts (optional)
                  </label>
                  <button
                    type="button"
                    onClick={addSizeChart}
                    className="inline-flex items-center space-x-1 text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Chart</span>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-3">Add labeled reference charts like Size Chart, Fabric Chart, Care Chart, etc. You can add multiple images per chart.</p>
                <div className="space-y-4">
                  {sizeCharts.map((chart, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-start mb-3">
                        <input
                          type="text"
                          value={chart.label}
                          onChange={(e) => handleSizeChartLabelChange(index, e.target.value)}
                          placeholder="e.g., Size Chart, Fabric Chart, Care Instructions"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        {sizeCharts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleSizeChartRemove(index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg justify-self-end"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                      <div>
                        <input
                          ref={(el) => { sizeChartInputRefs.current[index] = el }}
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleSizeChartUpload(index, e.target.files?.[0])}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => sizeChartInputRefs.current[index]?.click()}
                          disabled={sizeChartUploading[`${index}-upload`]}
                          className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <ImageIcon className="w-4 h-4" />
                          {sizeChartUploading[`${index}-upload`] ? 'Uploading...' : 'Add Image'}
                        </button>
                        <p className="text-xs text-gray-500 mt-2">Upload multiple images to show different angles or variations.</p>
                        
                        {chart.urls && chart.urls.length > 0 && (
                          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                            {chart.urls.map((url, imgIndex) => (
                              <div key={imgIndex} className="relative group">
                                <div className="aspect-[4/5] bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                                  <img
                                    src={url}
                                    alt={`${chart.label} - Image ${imgIndex + 1}`}
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSizeChartImage(index, imgIndex)}
                                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {sizeCharts.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No charts added yet. Click "Add chart" to get started.</p>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Color Options
                  </label>
                  <button
                    type="button"
                    onClick={addColorOption}
                    className="inline-flex items-center space-x-1 text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Color</span>
                  </button>
                </div>
                <div className="space-y-4">
                  {colorOptions.map((option, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-start">
                        <input
                          type="text"
                          value={option.name}
                          onChange={(e) => handleColorOptionChange(index, 'name', e.target.value)}
                          placeholder="e.g., Rose Gold"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        {colorOptions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeColorOption(index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg justify-self-end"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                      <div className="mt-3">
                        <input
                          ref={(el) => { colorImageInputRefs.current[index] = el }}
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleColorImageUpload(index, e.target.files?.[0])}
                          className="hidden"
                        />
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => colorImageInputRefs.current[index]?.click()}
                            disabled={colorImageUploading[index]}
                            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            <ImageIcon className="w-4 h-4" />
                            {colorImageUploading[index] ? 'Uploading...' : (option.image ? 'Change Image' : 'Upload Image')}
                          </button>
                          {option.image && (
                            <button
                              type="button"
                              onClick={() => handleColorImageRemove(index)}
                              className="text-sm text-red-600 hover:text-red-700"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        {option.image && (
                          <div className="mt-3 max-w-xs">
                            <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                              <img
                                src={option.image}
                                alt="Color reference"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-2">Optional image shown when this color is selected.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
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
                <p className="text-xs text-gray-500 mt-1">{countWords(formData.material)}/{WORD_LIMITS.material} words</p>
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
                <p className="text-xs text-gray-500 mt-1">{countWords(formData.careInstructions)}/{WORD_LIMITS.careInstructions} words</p>
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
                      <p className="text-xs text-gray-500 mt-1">{countWords(q.question)}/{WORD_LIMITS.question} words</p>
                      <label className="flex items-center space-x-2 mt-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={q.required}
                          onChange={(e) => handleQuestionChange(index, 'required', e.target.checked)}
                          className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">Required</span>
                      </label>
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Expected Answer Type</label>
                        <select
                          value={q.answerType || 'text'}
                          onChange={(e) => handleQuestionChange(index, 'answerType', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                          <option value="text">Text</option>
                          <option value="photo">Photo</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-2">
                          Buyers will answer with text or upload a photo based on this selection.
                        </p>
                      </div>
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

        {/* Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="border-b border-gray-200 p-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Import from Previous Product</h2>
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {importLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-gray-600">Loading your products...</p>
                  </div>
                ) : availableProducts.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">You don't have any previous products to import from yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {availableProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleImportFromProduct(product)}
                        className="w-full text-left border border-gray-200 rounded-lg p-4 hover:border-primary-500 hover:bg-primary-50 transition-all group"
                      >
                        <div className="flex items-start space-x-4">
                          {product.images && product.images.length > 0 && (
                            <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
                              <img
                                src={product.images[0]}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 truncate group-hover:text-primary-700">{product.name}</h3>
                            <p className="text-sm text-gray-600 mt-1">
                              {product.features && product.features.length > 0 && `${product.features.length} features`}
                              {product.size_charts && product.size_charts.length > 0 && ` • ${product.size_charts.length} charts`}
                              {product.custom_questions && product.custom_questions.length > 0 && ` • ${product.custom_questions.length} questions`}
                              {product.size_price_options && product.size_price_options.length > 0 && ` • ${product.size_price_options.length} sizes`}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                              Will import: All product information
                            </p>
                          </div>
                          <div className="flex-shrink-0">
                            <Package className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors" />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 p-6">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
