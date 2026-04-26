'use client'

import { use, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  Store, MapPin, Instagram, Star, Package, ShoppingBag, Heart, CheckCircle, ListFilter, X, Search, Menu, History, MessageSquare, Home, User
} from 'lucide-react'
import { ProductCard } from '@/app/components/ProductCard'
import { Layout } from '@/app/components/Layout'
import Link from 'next/link'
import Image from 'next/image'
import { useCart } from '@/app/contexts/CartContext'
import { useWishlist } from '@/app/contexts/WishlistContext'
import { useAuth } from '@/app/contexts/AuthContext'

export default function SellerProfilePage({ params }) {
  const { username } = use(params)
  const router = useRouter()
  const [seller, setSeller] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isSeller, setIsSeller] = useState(false)
  const [selectedSection, setSelectedSection] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')
  const [isOverlaySearchOpen, setIsOverlaySearchOpen] = useState(false)
  const [isSectionDrawerOpen, setIsSectionDrawerOpen] = useState(false)
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false)
  const overlaySearchInputRef = useRef(null)
  const { totalItems, setIsCartOpen } = useCart()
  const { wishlistCount } = useWishlist()
  const { user } = useAuth()

  useEffect(() => {
    const fetchSeller = async () => {
      try {
        setLoading(true)
        
        // First check if this is a reserved route
        const reservedRoutes = ['shop', 'product', 'login', 'register', 'admin', 'seller', 'orders', 'cart', 'support', 'gift-suggester', 'hamper-builder']
        if (reservedRoutes.includes(username)) {
          // This is a reserved route, redirect to 404 or home
          router.push('/')
          return
        }

        const response = await fetch(`/api/sellers/username/${username}`)
        const data = await response.json()

        if (!response.ok) {
          // Not a seller username, could be a 404 or other route
          if (response.status === 404) {
            setError('Seller not found')
            setIsSeller(false)
          } else {
            throw new Error(data.error || 'Error loading seller')
          }
          return
        }

        setSeller(data)
        setIsSeller(true)
      } catch (err) {
        setError(err.message)
        setIsSeller(false)
      } finally {
        setLoading(false)
      }
    }

    if (username) {
      fetchSeller()
    }
  }, [username, router])

  useEffect(() => {
    const handleSellerSearch = (event) => {
      const eventSeller = String(event?.detail?.sellerUsername || '').toLowerCase()
      if (eventSeller !== String(username || '').toLowerCase()) {
        return
      }

      const query = String(event?.detail?.query || '').trim()
      setSelectedSection('All')
      setSearchTerm(query)

      const productsContainer = document.getElementById('seller-products')
      if (productsContainer) {
        productsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }

    window.addEventListener('zaryah:seller-search', handleSellerSearch)
    return () => window.removeEventListener('zaryah:seller-search', handleSellerSearch)
  }, [username])

  const products = seller?.products || []

  const sectionOptions = useMemo(() => {
    const dynamicSections = products
      .map(product => product.section)
      .filter(Boolean)
      .map(section => String(section).trim())
      .filter(section => section.length > 0 && section !== 'New Arrivals')

    const uniqueSections = [...new Set(dynamicSections)]
    return ['All', 'New Arrivals', ...uniqueSections]
  }, [products])

  const baseSections = ['All', 'New Arrivals']
  const extraSections = useMemo(
    () => sectionOptions.filter(section => !baseSections.includes(section)),
    [sectionOptions]
  )

  const filteredProducts = useMemo(() => {
    let normalizedProducts = [...products]

    if (searchTerm) {
      const normalizedSearch = searchTerm.toLowerCase()
      normalizedProducts = normalizedProducts.filter(product =>
        String(product?.name || '').toLowerCase().includes(normalizedSearch) ||
        String(product?.description || '').toLowerCase().includes(normalizedSearch) ||
        String(product?.category || '').toLowerCase().includes(normalizedSearch)
      )
    }

    if (selectedSection === 'All') {
      return normalizedProducts
    }

    if (selectedSection === 'New Arrivals') {
      normalizedProducts = normalizedProducts.sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0))
    }

    if (selectedSection !== 'All' && selectedSection !== 'New Arrivals') {
      normalizedProducts = normalizedProducts.filter(product => String(product.section || '').trim() === selectedSection)
    }

    return normalizedProducts
  }, [products, searchTerm, selectedSection])

  const handleOverlaySearch = () => {
    setIsOverlaySearchOpen(true)
    setSelectedSection('All')
  }

  useEffect(() => {
    if (isOverlaySearchOpen && overlaySearchInputRef.current) {
      overlaySearchInputRef.current.focus()
    }
  }, [isOverlaySearchOpen])

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-elegant">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-200 border-t-primary-600 mx-auto mb-4"></div>
            <p className="text-charcoal-600 font-medium">Loading artisan profile...</p>
          </motion.div>
        </div>
      </Layout>
    )
  }

  if (error || !seller || !isSeller) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-elegant">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-md mx-auto px-4"
          >
            <div className="bg-white rounded-3xl shadow-xl p-8">
              <Store className="w-20 h-20 text-gray-300 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-charcoal-800 mb-3 font-serif">Artisan Not Found</h1>
              <p className="text-charcoal-600 mb-6">{error || 'The artisan you are looking for does not exist.'}</p>
              <Link href="/shop" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-secondary-600 text-white rounded-xl hover:shadow-lg transition-all">
                <ShoppingBag className="w-5 h-5" />
                Browse All Artisans
              </Link>
            </div>
          </motion.div>
        </div>
      </Layout>
    )
  }

  const sellerUser = seller.users || {}
  const stats = seller.stats || {}

  return (
    <Layout>
      <div className="bg-gradient-to-b from-cream-50 via-secondary-50 to-white pb-4">
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative w-full"
        >
          <div className="absolute right-3 top-3 md:right-5 md:top-5 z-40 flex items-center gap-2">
            <button
              type="button"
              onClick={handleOverlaySearch}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/20 text-white backdrop-blur-xl shadow-lg transition-colors hover:bg-white/30"
              aria-label="Search seller products"
            >
              <Search className="h-5 w-5" />
            </button>
            <Link
              href={`/wishlist?seller=${encodeURIComponent(username)}&back=${encodeURIComponent(`/${username}`)}`}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/20 text-white backdrop-blur-xl shadow-lg transition-colors hover:bg-white/30"
              aria-label="Open this seller wishlist"
            >
              <Heart className="h-5 w-5" />
              {wishlistCount > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[11px] font-semibold text-white ring-2 ring-white/70">
                  {wishlistCount}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/20 text-white backdrop-blur-xl shadow-lg transition-colors hover:bg-white/30"
              aria-label="Open cart"
            >
              <ShoppingBag className="h-5 w-5" />
              {totalItems > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[11px] font-semibold text-white ring-2 ring-white/70">
                  {totalItems}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsQuickMenuOpen(true)}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/20 text-white backdrop-blur-xl shadow-lg transition-colors hover:bg-white/30"
              aria-label="Open quick menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

          {isOverlaySearchOpen && (
            <div className="absolute left-3 right-3 top-16 md:left-auto md:right-5 md:top-16 z-40 md:w-[340px]">
              <div className="flex items-center gap-2 rounded-2xl border border-white/40 bg-white/20 p-2.5 text-white backdrop-blur-xl shadow-2xl">
                <Search className="h-4 w-4 shrink-0 text-white/90" />
                <input
                  ref={overlaySearchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSelectedSection('All')
                    setSearchTerm(e.target.value)
                  }}
                  placeholder="Search this seller's products"
                  className="w-full bg-transparent text-sm placeholder-white/80 outline-none"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOverlaySearchOpen(false)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                  aria-label="Close search"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {isQuickMenuOpen && (
            <div className="fixed inset-0 z-[90]">
              <button
                type="button"
                aria-label="Close quick menu"
                className="absolute inset-0 bg-black/55"
                onClick={() => setIsQuickMenuOpen(false)}
              />
              <motion.aside
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 top-0 h-full w-80 max-w-[86%] border-l border-primary-200 bg-cream-50/95 text-charcoal-900 backdrop-blur-xl shadow-2xl overflow-y-auto"
              >
                <div className="flex items-center justify-between border-b border-primary-200 px-4 py-4">
                  <h3 className="text-base font-semibold">Quick Menu</h3>
                  <button
                    type="button"
                    onClick={() => setIsQuickMenuOpen(false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary-200 bg-white hover:bg-cream-100 transition-colors"
                    aria-label="Close menu"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4 p-4">
                  <nav className="space-y-1.5">
                    <Link
                      href="/"
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium hover:bg-primary-50 transition-colors"
                      onClick={() => setIsQuickMenuOpen(false)}
                    >
                      <Home className="h-4 w-4" />
                      <span>Zaryah Home</span>
                    </Link>
                    <Link
                      href="/support"
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium hover:bg-primary-50 transition-colors"
                      onClick={() => setIsQuickMenuOpen(false)}
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span>Support</span>
                    </Link>
                    {user?.role === 'buyer' && (
                      <Link
                        href="/orders"
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium hover:bg-primary-50 transition-colors"
                        onClick={() => setIsQuickMenuOpen(false)}
                      >
                        <History className="h-4 w-4" />
                        <span>Past Orders</span>
                      </Link>
                    )}
                  </nav>

                  <div className="rounded-2xl border border-primary-200 bg-white p-3">
                    <p className="text-[11px] uppercase tracking-wider text-charcoal-500">Seller Details</p>
                    <p className="mt-1 text-sm font-semibold text-charcoal-900">{seller.business_name}</p>
                    <p className="mt-1 text-xs text-charcoal-600">@{seller.username}</p>
                    <p className="mt-1 text-xs text-charcoal-600">{seller.city || 'India'}</p>
                  </div>

                  {user && (
                    <div className="rounded-2xl border border-primary-200 bg-white p-3">
                      <p className="text-[11px] uppercase tracking-wider text-charcoal-500">My Profile</p>
                      <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-charcoal-900">
                        <User className="h-4 w-4" />
                        {user.name || user.full_name || user.username || 'User'}
                      </p>
                      <p className="mt-1 text-xs text-charcoal-600 break-all">{user.email || 'No email available'}</p>
                      <p className="mt-1 text-xs text-charcoal-600 capitalize">Role: {user.role || 'buyer'}</p>
                    </div>
                  )}
                </div>
              </motion.aside>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-b from-charcoal-900/80 via-charcoal-900/50 to-charcoal-900/70 z-10" />
          {seller.cover_photo ? (
            <div className="relative h-72 md:h-80 lg:h-96">
              {seller.cover_photo.match(/\.(mp4|webm|mov)$/i) ? (
                <video
                  src={seller.cover_photo}
                  className="h-full w-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              ) : (
                <Image
                  src={seller.cover_photo}
                  alt={`${seller.business_name} storefront cover`}
                  fill
                  className="object-cover"
                  priority
                />
              )}
            </div>
          ) : (
            <div className="h-72 md:h-80 lg:h-96 bg-gradient-to-br from-primary-900 via-primary-700 to-secondary-700" />
          )}

          <div className="absolute inset-0 z-20 pointer-events-none">
            <div className="absolute top-16 left-12 h-36 w-36 rounded-full bg-secondary-300/25 blur-3xl" />
            <div className="absolute bottom-20 right-16 h-52 w-52 rounded-full bg-primary-200/20 blur-3xl" />
          </div>

          <div className="absolute inset-x-0 bottom-4 md:bottom-5 lg:bottom-6 z-30">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <motion.div
                initial={{ y: 28, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="rounded-3xl border border-white/20 bg-white/15 backdrop-blur-md p-3 md:p-3.5 shadow-elegant"
              >
                <div className="flex flex-col lg:flex-row lg:items-end gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 rounded-full bg-secondary-200/60 blur-xl scale-110" />
                      <div className="relative h-16 w-16 md:h-20 md:w-20 rounded-full border-4 border-white/90 overflow-hidden bg-primary-300">
                        {sellerUser.profile_photo ? (
                          <Image
                            src={sellerUser.profile_photo}
                            alt={seller.business_name}
                            width={96}
                            height={96}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full grid place-items-center">
                            <Store className="w-10 h-10 text-white" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-xl md:text-3xl font-serif font-bold text-white truncate">
                          {seller.business_name}
                        </h1>
                        {sellerUser.is_approved && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 text-charcoal-800 text-xs font-semibold">
                            <CheckCircle className="w-3.5 h-3.5 text-success-600" />
                            Verified Seller
                          </span>
                        )}
                      </div>
                      <p className="text-xs md:text-sm text-white/85 font-medium">@{seller.username}</p>
                      {seller.business_description && (
                        <p className="text-xs md:text-sm text-white/90 mt-1.5 max-w-3xl line-clamp-1 md:line-clamp-2">
                          {seller.business_description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 w-full lg:w-auto">
                    <div className="rounded-2xl border border-white/25 bg-white/15 px-2.5 py-1.5">
                      <p className="text-[11px] uppercase tracking-wider text-white/80">Rating</p>
                      <p className="mt-0.5 text-white font-bold text-base inline-flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-300 text-yellow-300" />
                        {stats.averageRating > 0 ? Number(stats.averageRating).toFixed(1) : '0.0'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/25 bg-white/15 px-2.5 py-1.5">
                      <p className="text-[11px] uppercase tracking-wider text-white/80">Products</p>
                      <p className="mt-0.5 text-white font-bold text-base inline-flex items-center gap-1">
                        <Package className="w-4 h-4 text-white/90" />
                        {products.length}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/25 bg-white/15 px-2.5 py-1.5">
                      <p className="text-[11px] uppercase tracking-wider text-white/80">Location</p>
                      <p className="mt-0.5 text-white font-bold text-sm md:text-base inline-flex items-center gap-1">
                        <MapPin className="w-4 h-4 text-white/90" />
                        {seller.city || 'India'}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.section>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 md:mt-6 relative z-40">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 md:gap-8">
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              id="seller-products"
              className="rounded-3xl bg-white border border-cream-200 shadow-soft p-4 md:p-6"
            >
              <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-5 scrollbar-hide">
                {baseSections.map(section => {
                  const isActive = selectedSection === section
                  return (
                    <button
                      key={section}
                      onClick={() => setSelectedSection(section)}
                      className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                        isActive
                          ? 'bg-charcoal-900 text-white border-charcoal-900'
                          : 'bg-white text-charcoal-700 border-cream-300 hover:border-primary-300 hover:text-primary-700'
                      }`}
                    >
                      {section}
                    </button>
                  )
                })}
                <button
                  onClick={() => setIsSectionDrawerOpen(true)}
                  className="whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold border border-cream-300 bg-white text-charcoal-700 hover:border-primary-300 hover:text-primary-700 transition-colors inline-flex items-center gap-2"
                >
                  <ListFilter className="w-4 h-4" />
                  <span>More Sections</span>
                </button>
              </div>

              {isSectionDrawerOpen && (
                <div className="fixed inset-0 z-50">
                  <button
                    type="button"
                    aria-label="Close sections drawer"
                    className="absolute inset-0 bg-black/45"
                    onClick={() => setIsSectionDrawerOpen(false)}
                  />
                  <div className="absolute left-0 top-0 h-full w-72 max-w-[80%] bg-white shadow-2xl p-5 overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-charcoal-900">Seller Sections</h3>
                      <button
                        type="button"
                        onClick={() => setIsSectionDrawerOpen(false)}
                        className="p-2 rounded-lg text-charcoal-600 hover:text-charcoal-900 hover:bg-cream-100 transition-colors"
                        aria-label="Close sections"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    {extraSections.length === 0 ? (
                      <p className="text-sm text-charcoal-600">No extra sections yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {extraSections.map(section => {
                          const isActive = selectedSection === section
                          return (
                            <button
                              key={section}
                              type="button"
                              onClick={() => {
                                setSelectedSection(section)
                                setIsSectionDrawerOpen(false)
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                                isActive
                                  ? 'bg-charcoal-900 text-white border-charcoal-900'
                                  : 'bg-white text-charcoal-700 border-cream-300 hover:border-primary-300 hover:text-primary-700'
                              }`}
                            >
                              {section}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {filteredProducts.length > 0 ? (
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={{
                    visible: {
                      transition: {
                        staggerChildren: 0.06
                      }
                    }
                  }}
                  className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5"
                >
                  {filteredProducts.map((product) => (
                    <motion.div
                      key={product.id}
                      variants={{
                        hidden: { opacity: 0, y: 16 },
                        visible: { opacity: 1, y: 0 }
                      }}
                    >
                      <ProductCard product={product} />
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <div className="text-center py-14 bg-gradient-to-br from-cream-50 to-secondary-50 rounded-2xl border-2 border-dashed border-cream-300">
                  <Package className="w-14 h-14 text-cream-400 mx-auto mb-3" />
                  <p className="text-charcoal-700 text-base font-semibold">No products in this section yet</p>
                  <p className="text-charcoal-500 text-sm mt-1">Switch section to explore more from this seller.</p>
                </div>
              )}

              {products.length >= 20 && (
                <div className="mt-7 text-center">
                  <Link
                    href={`/shop?seller=${username}`}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-700 to-secondary-700 text-white text-base font-semibold rounded-xl hover:shadow-large transition-all"
                  >
                    <ShoppingBag className="w-5 h-5" />
                    View All Products
                  </Link>
                </div>
              )}
            </motion.section>

            <motion.aside
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="space-y-4 md:space-y-5 lg:sticky lg:top-24 h-fit"
            >
              <div className="rounded-3xl border border-cream-200 bg-gradient-to-br from-white to-cream-50 p-5 shadow-soft">
                <h3 className="text-lg font-serif font-bold text-charcoal-900 mb-2">About This Studio</h3>
                {seller.story ? (
                  <p className="text-sm text-charcoal-700 leading-relaxed">{seller.story}</p>
                ) : (
                  <p className="text-sm text-charcoal-600 leading-relaxed">
                    Every product in this page is crafted by {seller.business_name}. Explore their collection and follow for new drops.
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-4">
                  {seller.city && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-100 text-primary-800 text-xs font-semibold">
                      <MapPin className="w-3.5 h-3.5" />
                      {seller.city}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary-100 text-secondary-800 text-xs font-semibold">
                    <Heart className="w-3.5 h-3.5" />
                    Independent Seller
                  </span>
                </div>
              </div>

              {seller.instagram && (
                <a
                  href={`https://instagram.com/${seller.instagram.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block rounded-3xl border border-primary-200 bg-gradient-to-br from-primary-700 to-secondary-700 p-5 shadow-medium"
                >
                  <p className="text-xs uppercase tracking-[0.12em] text-white/80 mb-1">Follow the studio</p>
                  <h3 className="text-xl font-serif font-bold text-white mb-3 inline-flex items-center gap-2">
                    <Instagram className="w-5 h-5" />
                    @{seller.instagram.replace('@', '')}
                  </h3>
                  <p className="text-sm text-white/90">See behind-the-scenes, launches, and custom work updates.</p>
                </a>
              )}
            </motion.aside>
          </div>
        </div>
      </div>
    </Layout>
  )
}

