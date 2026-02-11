'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, Filter, Grid, List, SlidersHorizontal, User, MapPin } from 'lucide-react'
import { ProductCard } from './ProductCard'
import { apiService } from '../services/api'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export const ShopPage = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchTerm, setSearchTerm] = useState('')
  const [searchType, setSearchType] = useState('products') // 'products' or 'artisans'
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [priceRange, setPriceRange] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [viewMode, setViewMode] = useState('grid')
  const [showFilters, setShowFilters] = useState(false)
  const [products, setProducts] = useState([])
  const [artisans, setArtisans] = useState([])
  const [loading, setLoading] = useState(true)

  // Check for search query in URL params
  useEffect(() => {
    const searchQuery = searchParams.get('search')
    if (searchQuery) {
      setSearchTerm(searchQuery)
    }
  }, [searchParams])

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    
    const fetchData = async () => {
      try {
        // Fetch only products first for faster initial load
        const productsData = await apiService.getApprovedProducts();
        
        if (isMounted) {
          setProducts(productsData || []);
          setLoading(false);
        }
        
        // Fetch artisans after products (non-blocking)
        const artisansData = await apiService.getSellers();
        if (isMounted) {
          setArtisans(artisansData || []);
        }
      } catch (e) {
        console.error('Error fetching shop data:', e);
        if (isMounted) {
          setProducts([]);
          setArtisans([]);
          setLoading(false);
        }
      }
    };
    
    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, []);

  const categories = [
    'all',
    'Resin Art',
    'Crochet',
    'Knitting',
    'Pottery',
    'Jewelry',
    'Candles',
    'Home Decor',
    'Textiles',
    'Leather Work',
    'Woodwork',
    'Paper Crafts',
    'Embroidery',
    'Painting',
    'Soap Making',
    'Macrame',
    'For Him',
    'For Her', 
    'For Kids',
    'Wellness',
    'Personalized Gifts'
  ]

  const priceRanges = [
    { label: 'All Prices', value: 'all' },
    { label: 'Under ₹500', value: '0-500' },
    { label: '₹500 - ₹1000', value: '500-1000' },
    { label: '₹1000 - ₹2500', value: '1000-2500' },
    { label: '₹2500 - ₹5000', value: '2500-5000' },
    { label: 'Above ₹5000', value: '5000+' }
  ]

  const sortOptions = [
    { label: 'Newest First', value: 'newest' },
    { label: 'Price: Low to High', value: 'price-asc' },
    { label: 'Price: High to Low', value: 'price-desc' },
    { label: 'Most Popular', value: 'popular' }
  ]

  const filteredArtisans = useMemo(() => {
    let filtered = artisans.filter(a => a.users?.is_approved)

    // Search filter for artisans
    if (searchTerm && searchType === 'artisans') {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(artisan =>
        artisan.business_name?.toLowerCase().includes(term) ||
        artisan.business_description?.toLowerCase().includes(term) ||
        artisan.city?.toLowerCase().includes(term) ||
        artisan.username?.toLowerCase().includes(term)
      )
    }

    // Category filter for artisans (based on business description)
    if (selectedCategory !== 'all' && searchType === 'artisans') {
      const term = selectedCategory.toLowerCase()
      filtered = filtered.filter(artisan =>
        artisan.business_description?.toLowerCase().includes(term.replace(' ', ''))
      )
    }

    return filtered
  }, [artisans, searchTerm, selectedCategory, searchType])

  const filteredProducts = useMemo(() => {
    let filtered = products

    // Search filter
    if (searchTerm && searchType === 'products') {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.sellerName && product.sellerName.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    // Category filter - check both primary category, categories array, and description
    if (selectedCategory !== 'all' && searchType === 'products') {
      const term = selectedCategory.toLowerCase().replace(' ', '')
      filtered = filtered.filter(product => 
        product.category === selectedCategory || 
        (product.categories && product.categories.includes(selectedCategory.toLowerCase().replace(' ', '-'))) ||
        product.description?.toLowerCase().includes(term) ||
        product.name?.toLowerCase().includes(term)
      )
    }

    // Price range filter
    if (priceRange !== 'all') {
      const [min, max] = priceRange.split('-').map(Number)
      filtered = filtered.filter(product => {
        if (priceRange === '5000+') {
          return product.price >= 5000
        }
        return product.price >= min && product.price <= max
      })
    }

    // Sort
    switch (sortBy) {
      case 'price-asc':
        filtered.sort((a, b) => a.price - b.price)
        break
      case 'price-desc':
        filtered.sort((a, b) => b.price - a.price)
        break
      case 'popular':
        // Mock popularity sort
        filtered.sort(() => Math.random() - 0.5)
        break
      case 'newest':
      default:
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        break
    }

    return filtered
  }, [products, searchTerm, selectedCategory, priceRange, sortBy])

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 to-primary-50 py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Search and Filters */}
        <div className="bg-white rounded-2xl shadow-soft border border-primary-100 p-3 sm:p-4 mb-4">
          {/* Search Type Tabs */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setSearchType('products')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
                searchType === 'products'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-charcoal-600 hover:bg-gray-200'
              }`}
            >
              Products
            </button>
            <button
              onClick={() => setSearchType('artisans')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
                searchType === 'artisans'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-charcoal-600 hover:bg-gray-200'
              }`}
            >
              Artisans
            </button>
          </div>

          {/* Search Bar */}
          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-charcoal-400 w-4 h-4" />
              <input
                type="text"
                placeholder={searchType === 'products' ? 'Search products...' : 'Search artisans...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 text-sm border border-primary-200 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent text-charcoal-700"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All Categories' : category}
                </option>
              ))}
            </select>

            {/* Price Range Filter - Only for products */}
            {searchType === 'products' && (
              <select
                value={priceRange}
                onChange={(e) => setPriceRange(e.target.value)}
                className="px-3 py-2 text-sm border border-primary-200 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent text-charcoal-700"
              >
                {priceRanges.map(range => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
            )}

            {/* Sort - Only for products */}
            {searchType === 'products' && (
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 text-sm border border-primary-200 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent text-charcoal-700"
              >
                {sortOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}

            {/* View Mode Toggle - Only for products */}
            {searchType === 'products' && (
              <div className="flex items-center space-x-2 ml-auto">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'grid' 
                      ? 'bg-primary-100 text-primary-600' 
                      : 'text-charcoal-400 hover:text-charcoal-600'
                  }`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'list' 
                      ? 'bg-primary-100 text-primary-600' 
                      : 'text-charcoal-400 hover:text-charcoal-600'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <>
            {/* Results Count */}
            <div className="mb-3">
              <p className="text-charcoal-600">
                {searchType === 'products' 
                  ? `Showing ${filteredProducts.length} of ${products.length} products`
                  : `Showing ${filteredArtisans.length} of ${artisans.filter(a => a.users?.is_approved).length} artisans`
                }
              </p>
            </div>

            {/* Artisans Results - Instagram Style */}
            {searchType === 'artisans' && (
          filteredArtisans.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-cream-100 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-cream-200">
                <User className="w-8 h-8 text-charcoal-400" />
              </div>
              <h3 className="text-lg font-semibold text-charcoal-900 mb-2">No artisans found</h3>
              <p className="text-charcoal-600">Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredArtisans.map((artisan) => (
                <Link
                  key={artisan.id}
                  href={`/${artisan.username}`}
                  className="block"
                >
                  <motion.div
                    whileHover={{ y: -2 }}
                    className="bg-white rounded-xl shadow-sm hover:shadow-md border border-primary-100 p-4 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      {/* Profile Photo */}
                      <div className="flex-shrink-0">
                        {artisan.users?.profile_photo || artisan.cover_photo ? (
                          <img
                            src={artisan.users?.profile_photo || artisan.cover_photo}
                            alt={artisan.business_name}
                            className="w-14 h-14 rounded-full object-cover border-2 border-primary-200"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center">
                            <User className="w-7 h-7 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-charcoal-900 truncate">
                          {artisan.business_name}
                        </h3>
                        <p className="text-sm text-charcoal-600 truncate">
                          @{artisan.username}
                        </p>
                        {artisan.city && (
                          <div className="flex items-center gap-1 text-xs text-charcoal-500 mt-1">
                            <MapPin className="w-3 h-3" />
                            <span>{artisan.city}</span>
                          </div>
                        )}
                      </div>

                      {/* Arrow */}
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center">
                          <svg className="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {artisan.business_description && (
                      <p className="text-sm text-charcoal-600 mt-3 line-clamp-2">
                        {artisan.business_description}
                      </p>
                    )}
                  </motion.div>
                </Link>
              ))}
            </div>
          )
        )}

        {/* Products Grid */}
        {searchType === 'products' && (
          filteredProducts.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-cream-100 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-cream-200">
                <Search className="w-8 h-8 text-charcoal-400" />
              </div>
              <h3 className="text-lg font-semibold text-charcoal-900 mb-2">No products found</h3>
              <p className="text-charcoal-600">Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            <div className={`grid gap-4 ${
              viewMode === 'grid' 
                ? 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                : 'grid-cols-1'
            }`}>
              {filteredProducts.map((product) => (
                <ProductCard key={product.id || product._id} product={product} />
              ))}
            </div>
          )
        )}
          </>
        )}
      </div>
    </div>
  )
}
