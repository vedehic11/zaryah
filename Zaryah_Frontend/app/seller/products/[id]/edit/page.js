'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/app/contexts/AuthContext'
import { apiService } from '@/app/services/api'

const CATEGORY_OPTIONS = [
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

const DEFAULT_SECTION_OPTIONS = ['Featured', 'Trending', 'New Arrivals', 'Best Sellers']

function toInputValue(value) {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

export default function EditSellerProductPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const productId = useMemo(() => params?.id, [params])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [product, setProduct] = useState(null)
  const [sectionOptions, setSectionOptions] = useState(DEFAULT_SECTION_OPTIONS)
  const [hasCustomSections, setHasCustomSections] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    mrp: '',
    category: '',
    section: '',
    stock: '',
    weight: '',
    delivery_time_min: '',
    delivery_time_max: '',
    delivery_time_unit: 'days',
    material: '',
    care_instructions: '',
    legal_disclaimer: '',
    size_options: '',
    cod_available: true,
    instant_delivery: false,
    customisable: false,
    return_available: true,
    exchange_available: true,
    return_days: '7'
  })

  useEffect(() => {
    if (authLoading) {
      return
    }

    if (!user) {
      router.replace('/login')
      return
    }

    const normalizedUserType = String(user.role || user.userType || user.user_type || '').toLowerCase()
    if (normalizedUserType !== 'seller' && normalizedUserType !== 'admin') {
      toast.error('You are not allowed to edit products')
      router.replace('/seller/dashboard')
      return
    }

    if (!productId) {
      return
    }

    const loadSections = async () => {
      try {
        const sellerSections = await apiService.getSellerSections()
        const names = (sellerSections || [])
          .map(section => String(section?.name || '').trim())
          .filter(Boolean)

        if (names.length > 0) {
          setSectionOptions(names)
          setHasCustomSections(true)

          // If the product currently has a section that is not part of seller-defined sections,
          // ask the seller to choose one of their sections before saving.
          setFormData(prev => {
            const current = String(prev.section || '').trim()
            if (!current) return prev
            if (names.includes(current)) return prev
            return {
              ...prev,
              section: ''
            }
          })
        } else {
          setHasCustomSections(false)
        }
      } catch (error) {
        console.error('Failed to load seller sections for edit product:', error)
        setHasCustomSections(false)
      }
    }

    const loadProduct = async () => {
      try {
        setLoading(true)
        const productData = await apiService.getProduct(productId)
        setProduct(productData)
        setFormData({
          name: toInputValue(productData.name),
          description: toInputValue(productData.description),
          price: toInputValue(productData.price),
          mrp: toInputValue(productData.mrp),
          category: toInputValue(productData.category),
          section: toInputValue(productData.section),
          stock: toInputValue(productData.stock),
          weight: toInputValue(productData.weight),
          delivery_time_min: toInputValue(productData.delivery_time_min),
          delivery_time_max: toInputValue(productData.delivery_time_max),
          delivery_time_unit: toInputValue(productData.delivery_time_unit || 'days'),
          material: toInputValue(productData.material),
          care_instructions: toInputValue(productData.care_instructions),
          legal_disclaimer: toInputValue(productData.legal_disclaimer),
          size_options: toInputValue(productData.size_options),
          cod_available: Boolean(productData.cod_available),
          instant_delivery: Boolean(productData.instant_delivery),
          customisable: Boolean(productData.customisable),
          return_available: productData.return_available !== false,
          exchange_available: productData.exchange_available !== false,
          return_days: toInputValue(productData.return_days ?? 7)
        })
      } catch (error) {
        console.error('Failed to load product for editing:', error)
        toast.error(error.message || 'Failed to load product')
      } finally {
        setLoading(false)
      }
    }

    loadSections()
    loadProduct()
  }, [authLoading, productId, router, user])

  const sectionSelectOptions = useMemo(() => {
    // If seller has custom sections, restrict choices to those sections only.
    // Otherwise keep the default sections list.
    return [...sectionOptions]
  }, [sectionOptions])

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!formData.name.trim() || !formData.description.trim()) {
      toast.error('Name and description are required')
      return
    }

    if (!formData.price || Number(formData.price) <= 0) {
      toast.error('Enter a valid selling price')
      return
    }

    if (formData.mrp && Number(formData.mrp) < Number(formData.price)) {
      toast.error('MRP cannot be lower than selling price')
      return
    }

    if (!formData.category) {
      toast.error('Category is required')
      return
    }

    if (!String(formData.section || '').trim()) {
      toast.error('Section is required')
      return
    }

    try {
      setSaving(true)

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: Number(formData.price),
        mrp: formData.mrp ? Number(formData.mrp) : null,
        category: formData.category,
        section: String(formData.section).trim(),
        stock: formData.stock === '' ? 0 : Number(formData.stock),
        weight: formData.weight === '' ? null : Number(formData.weight),
        delivery_time_min: formData.delivery_time_min === '' ? null : Number(formData.delivery_time_min),
        delivery_time_max: formData.delivery_time_max === '' ? null : Number(formData.delivery_time_max),
        delivery_time_unit: formData.delivery_time_unit || 'days',
        material: formData.material.trim() || null,
        care_instructions: formData.care_instructions.trim() || null,
        legal_disclaimer: formData.legal_disclaimer.trim() || null,
        size_options: formData.size_options
          ? formData.size_options.split(',').map(option => option.trim()).filter(Boolean)
          : [],
        cod_available: formData.cod_available,
        instant_delivery: formData.instant_delivery,
        customisable: formData.customisable,
        return_available: formData.return_available,
        exchange_available: formData.exchange_available,
        return_days: formData.return_days === '' ? null : Number(formData.return_days)
      }

      await apiService.updateProduct(productId, payload)
      toast.success('Product updated successfully')
      router.push('/seller/dashboard')
      router.refresh()
    } catch (error) {
      console.error('Failed to update product:', error)
      toast.error(error.message || 'Failed to update product')
    } finally {
      setSaving(false)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/seller/dashboard" className="inline-flex items-center text-sm text-gray-600 hover:text-primary-600 mb-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Edit product</h1>
            <p className="text-sm text-gray-500 mt-1">Update the product details shown to buyers.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white shadow-sm border border-gray-200 rounded-2xl p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Product name</span>
              <input name="name" value={formData.name} onChange={handleChange} className="w-full rounded-lg border border-gray-300 px-3 py-2" required />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Category</span>
              <select name="category" value={formData.category} onChange={handleChange} className="w-full rounded-lg border border-gray-300 px-3 py-2">
                <option value="">Select category</option>
                {CATEGORY_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="block text-sm font-medium text-gray-700 mb-1">Description</span>
              <textarea name="description" value={formData.description} onChange={handleChange} rows={5} className="w-full rounded-lg border border-gray-300 px-3 py-2" required />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Price</span>
              <input type="number" min="0" step="0.01" name="price" value={formData.price} onChange={handleChange} className="w-full rounded-lg border border-gray-300 px-3 py-2" required />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">MRP</span>
              <input type="number" min="0" step="0.01" name="mrp" value={formData.mrp} onChange={handleChange} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Stock</span>
              <input type="number" min="0" step="1" name="stock" value={formData.stock} onChange={handleChange} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Weight (grams)</span>
              <input type="number" min="0" step="0.01" name="weight" value={formData.weight} onChange={handleChange} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Section</span>
              <select name="section" value={formData.section} onChange={handleChange} className="w-full rounded-lg border border-gray-300 px-3 py-2" required>
                <option value="">Select section</option>
                {sectionSelectOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {hasCustomSections
                  ? 'Choose one of your self-made sections (manage them in Seller Dashboard → Products).'
                  : 'No custom sections found yet. Create sections in Seller Dashboard → Products.'}
              </p>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Size options</span>
              <input name="size_options" value={formData.size_options} onChange={handleChange} placeholder="Small, Medium, Large" className="w-full rounded-lg border border-gray-300 px-3 py-2" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Delivery min</span>
              <input type="number" min="0" step="1" name="delivery_time_min" value={formData.delivery_time_min} onChange={handleChange} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Delivery max</span>
              <input type="number" min="0" step="1" name="delivery_time_max" value={formData.delivery_time_max} onChange={handleChange} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Delivery unit</span>
              <select name="delivery_time_unit" value={formData.delivery_time_unit} onChange={handleChange} className="w-full rounded-lg border border-gray-300 px-3 py-2">
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Return days</span>
              <input type="number" min="0" step="1" name="return_days" value={formData.return_days} onChange={handleChange} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
            </label>
            <label className="block md:col-span-2">
              <span className="block text-sm font-medium text-gray-700 mb-1">Material</span>
              <input name="material" value={formData.material} onChange={handleChange} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
            </label>
            <label className="block md:col-span-2">
              <span className="block text-sm font-medium text-gray-700 mb-1">Care instructions</span>
              <textarea name="care_instructions" value={formData.care_instructions} onChange={handleChange} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
            </label>
            <label className="block md:col-span-2">
              <span className="block text-sm font-medium text-gray-700 mb-1">Legal disclaimer</span>
              <textarea name="legal_disclaimer" value={formData.legal_disclaimer} onChange={handleChange} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              ['cod_available', 'Cash on delivery available'],
              ['instant_delivery', 'Instant delivery available'],
              ['customisable', 'Customisable'],
              ['return_available', 'Returns available'],
              ['exchange_available', 'Exchanges available']
            ].map(([field, label]) => (
              <label key={field} className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3">
                <input type="checkbox" name={field} checked={Boolean(formData[field])} onChange={handleChange} className="h-4 w-4 rounded border-gray-300" />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>

          {Array.isArray(product?.images) && product.images.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-700 mb-2">Current images</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {product.images.map((image, index) => (
                  <div key={`${image}-${index}`} className="relative h-28 w-full rounded-lg overflow-hidden border border-gray-200">
                    <Image src={image} alt={`Product image ${index + 1}`} fill className="object-cover" />
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">Image replacement is not enabled on this screen yet, but existing images are preserved.</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Link href="/seller/dashboard" className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
              Cancel
            </Link>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
