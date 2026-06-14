'use client'

import { useState, useCallback, useMemo, useEffect, Suspense } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  Heart, 
  User, 
  Gift, 
  LogOut, 
  Menu, 
  X,
  Package,
  History,
  ShoppingBag,
  Bell,
  MessageSquare,
  Search
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useCart } from '../contexts/CartContext'
const CartIcon = dynamic(() => import('./CartIcon').then(mod => mod.CartIcon), { 
  ssr: false, 
  loading: () => <div className="p-2 rounded-full" style={{ width: '40px', height: '40px' }} />
})
import { WishlistIcon } from './WishlistIcon'
import { CartSidebar } from './CartSidebar'
import { NotificationCenter } from './NotificationCenter'
import { UserAvatar } from './UserAvatar'
import { apiService } from '../services/api'

const SearchParamsHandler = dynamic(() => import('./SearchParamsHandler').then(mod => mod.SearchParamsHandler), {
  ssr: false,
  loading: () => null
})

const LOGO_SRC = '/assets/image.png?v=20260501'
const ROOT_DOMAIN = 'zaryah.in'

// NotificationSidebar component (like CartSidebar)
function NotificationSidebar({ isOpen, onClose, onUnreadCountChange }) {
  return (
    <div className={`fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      style={{ transitionProperty: 'transform' }}>
      <div className="flex items-center justify-between p-6 border-b border-primary-200 bg-primary-50">
        <div className="flex items-center space-x-3">
          <div className="bg-primary-600 p-2 rounded-lg">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-lg font-bold text-primary-900">Notifications</h2>
        </div>
        <button
          onClick={onClose}
          className="text-primary-600 hover:text-primary-800 p-2 hover:bg-primary-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <NotificationCenter isOpen={isOpen} onUnreadCountChange={onUnreadCountChange} />
      </div>
    </div>
  )
}

export const Layout = ({ children, dynamicNavItems = [] }) => {
  const { user, logout, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [hostSubdomain, setHostSubdomain] = useState(null)
  const [returnToSeller, setReturnToSeller] = useState('')
  const reservedTopLevelRoutes = useMemo(() => new Set([
    '',
    'shop',
    'product',
    'login',
    'register',
    'admin',
    'seller',
    'orders',
    'cart',
    'support',
    'gift-suggester',
    'hamper-builder',
    'checkout',
    'wishlist',
    'addresses',
    'reset-password',
    'api',
    'terms',
    'terms-and-conditions',
    'privacy-policy',
    'refund-policy',
    'return-policy',
    'shipping-policy',
    'contact-us'
  ]), [])
  const pathSegments = useMemo(() => (pathname || '').split('/').filter(Boolean), [pathname])
  const pathSellerUsername = useMemo(() => {
    if (pathSegments.length !== 1) return null
    if (reservedTopLevelRoutes.has(pathSegments[0])) return null
    return pathSegments[0]
  }, [pathSegments, reservedTopLevelRoutes])
  const currentSellerUsername = useMemo(() => {
    return hostSubdomain || pathSellerUsername
  }, [hostSubdomain, pathSellerUsername])
  const isUsernameBrandPage = useMemo(() => Boolean(currentSellerUsername), [currentSellerUsername])
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchSuggestions, setSearchSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [products, setProducts] = useState([])
  const [productsLoaded, setProductsLoaded] = useState(false)
  // const { syncGuestCartToBackend } = useCart() // Removed automatic syncing

  useEffect(() => {
    if (typeof window === 'undefined') return
    const host = window.location.hostname.toLowerCase()
    if (host.endsWith(`.${ROOT_DOMAIN}`) && host !== ROOT_DOMAIN && host !== `www.${ROOT_DOMAIN}`) {
      setHostSubdomain(host.slice(0, -(ROOT_DOMAIN.length + 1)))
    } else {
      setHostSubdomain(null)
    }
  }, [])

  const [currentPath, setCurrentPath] = useState('/')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentPath(window.location.pathname + window.location.search)
    }
  }, [pathname])

  const handleRedirectParam = useCallback((redirectParam) => {
    setReturnToSeller(redirectParam)
  }, [])

  const getNavHref = useCallback((href) => {
    if (!hostSubdomain) return href
    if (href === '/') return `https://${ROOT_DOMAIN}/`
    return href
  }, [hostSubdomain])

  // Load products for search suggestions only when needed
  const getContextualProducts = useCallback((allProducts = []) => {
    if (!currentSellerUsername) return allProducts
    const normalizedUsername = currentSellerUsername.toLowerCase()
    return allProducts.filter(product => String(product?.seller?.username || '').toLowerCase() === normalizedUsername)
  }, [currentSellerUsername])

  const loadProducts = async () => {
    if (productsLoaded) return getContextualProducts(products)
    try {
      const data = await apiService.getApprovedProducts()
      setProducts(data || [])
      setProductsLoaded(true)
      return getContextualProducts(data || [])
    } catch (error) {
      console.error('Error loading products:', error)
      return []
    }
  }

  useEffect(() => {
    if (!user && !authLoading) {
      setUnreadCount(0)
    }
  }, [user, authLoading])

  // Auto-sync guest cart when user logs in - REMOVED
  // useEffect(() => {
  //   if (user && user.token) {
  //     // Small delay to ensure cart context is ready
  //     const timer = setTimeout(() => {
  //       syncGuestCartToBackend();
  //     }, 1000);
  //     
  //     return () => clearTimeout(timer);
  //   }
  // }, [user, syncGuestCartToBackend]);

  const handleLogout = useCallback(async () => {
    await logout()
    router.push('/')
  }, [logout, router])

  const handleSellerSearchIconClick = useCallback(() => {
    if (!currentSellerUsername) return

    const query = window.prompt('Search this seller\'s products', searchQuery || '')
    if (query === null) return

    const normalizedQuery = query.trim()
    setSearchQuery(normalizedQuery)
    setShowSuggestions(false)

    window.dispatchEvent(new CustomEvent('zaryah:seller-search', {
      detail: {
        query: normalizedQuery,
        sellerUsername: currentSellerUsername
      }
    }))

    const productsContainer = document.getElementById('seller-products')
    if (productsContainer) {
      productsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [currentSellerUsername, searchQuery])

  // Handle search input change with debouncing - generate text suggestions from product names
  const handleSearchChange = async (e) => {
    const value = e.target.value
    setSearchQuery(value)

    if (currentSellerUsername && value.trim().length === 0) {
      setSearchSuggestions([])
      setShowSuggestions(false)
      window.dispatchEvent(new CustomEvent('zaryah:seller-search', {
        detail: {
          query: '',
          sellerUsername: currentSellerUsername
        }
      }))
      return
    }
    
    if (value.trim().length > 1) {
      // Load products only when user starts typing
      const productData = await loadProducts()
      
      // Extract unique search terms from product names and categories
      const searchTerms = new Set()
      
      productData.forEach(product => {
        // Add product name words
        const words = product.name.toLowerCase().split(' ')
        words.forEach(word => {
          if (word.length > 2 && word.includes(value.toLowerCase())) {
            searchTerms.add(product.name)
          }
        })
        
        // Add category if it matches
        if (product.category?.toLowerCase().includes(value.toLowerCase())) {
          searchTerms.add(product.category)
        }
      })
      
      const suggestions = Array.from(searchTerms).slice(0, 6)
      setSearchSuggestions(suggestions)
      setShowSuggestions(suggestions.length > 0)
    } else {
      setSearchSuggestions([])
      setShowSuggestions(false)
    }
  }

  // Handle search submit
  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      setShowSuggestions(false)
      if (currentSellerUsername) {
        window.dispatchEvent(new CustomEvent('zaryah:seller-search', {
          detail: {
            query: searchQuery.trim(),
            sellerUsername: currentSellerUsername
          }
        }))
        return
      }
      router.push(`/shop?search=${encodeURIComponent(searchQuery)}`)
    }
  }

  // Handle suggestion click - just populate and search
  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion)
    setShowSuggestions(false)
    if (currentSellerUsername) {
      window.dispatchEvent(new CustomEvent('zaryah:seller-search', {
        detail: {
          query: suggestion,
          sellerUsername: currentSellerUsername
        }
      }))
      return
    }
    router.push(`/shop?search=${encodeURIComponent(suggestion)}`)
  }

  const getBuyerNavigation = useCallback(() => {
    if (isUsernameBrandPage) {
      return [
        { name: 'Past Orders', href: '/orders', icon: History }
      ]
    }

    return [
      { name: 'Home', href: '/', icon: Heart },
      { name: 'Shop', href: '/shop', icon: ShoppingBag },
      { name: 'Gift Suggester', href: '/gift-suggester', icon: Gift },
      { name: 'Hamper Builder', href: '/hamper-builder', icon: Package },
      ...(user ? [
        { name: 'Orders', href: '/orders', icon: History },
        { name: 'Support', href: '/support', icon: MessageSquare }
      ] : [])
    ]
  }, [user, isUsernameBrandPage, dynamicNavItems])

  const getSellerNavigation = useCallback(() => [
    { name: 'Dashboard', href: '/seller/dashboard', icon: User },
  ], [])

  const getAdminNavigation = useCallback(() => [
    { name: 'Dashboard', href: '/admin/dashboard', icon: User },
  ], [])

  const navigation = useMemo(() => {
    if (!user) return getBuyerNavigation()
    switch (user.role) {
      case 'seller': return getSellerNavigation()
      case 'admin': return getAdminNavigation()
      default: return getBuyerNavigation()
    }
  }, [user, getBuyerNavigation, getSellerNavigation, getAdminNavigation])

  useEffect(() => {
    if (isUsernameBrandPage) {
      setIsMenuOpen(false)
    }
  }, [isUsernameBrandPage])

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Search Params Handler */}
      <Suspense fallback={null}>
        <SearchParamsHandler onRedirectParamFound={handleRedirectParam} />
      </Suspense>
      
      {/* Header */}
      {!isUsernameBrandPage && (
      <header className="bg-cream-50/95 backdrop-blur-md border-b border-cream-200 sticky top-0 z-50 shadow-lg">
        <div className="hidden lg:flex w-full items-center justify-between py-3 px-4 xl:px-6">
          {/* Logo - Left Side */}
          <div className="flex-shrink-0 flex items-center justify-start">
            <Link href={getNavHref('/')} className="flex items-center">
              <Image
                src={LOGO_SRC}
                alt="Zaryah"
                width={260}
                height={78}
                className="h-12 xl:h-14 w-auto"
                priority
              />
            </Link>
          </div>
          {/* Center Navigation */}
          {!isUsernameBrandPage && (
            <nav className="flex flex-1 justify-center gap-8 xl:gap-12">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              
              if (item.isAnchor) {
                return (
                  <button
                    key={item.name}
                    onClick={(e) => {
                      e.preventDefault()
                      if (item.onClick) {
                        item.onClick()
                      }
                    }}
                    className={`flex items-center gap-1 text-base xl:text-lg font-medium transition-colors duration-200 cursor-pointer ${
                      'text-neutral-900 hover:text-primary-600'
                    }`}
                    style={{ background: 'none', boxShadow: 'none', padding: 0, border: 'none' }}
                  >
                    <Icon className="w-5 h-5 xl:w-6 xl:h-6" />
                    <span>{item.name}</span>
                  </button>
                )
              }
              
              return (
                <Link
                  key={item.name}
                    href={getNavHref(item.href)}
                  prefetch={true}
                  className={`flex items-center gap-1 text-base xl:text-lg font-medium transition-colors duration-200 ${
                    isActive ? 'text-primary-700 underline underline-offset-8 decoration-2' : 'text-neutral-900 hover:text-primary-600'
                  }`}
                  style={{ textDecoration: 'none', background: 'none', boxShadow: 'none', padding: 0 }}
                >
                  <Icon className="w-5 h-5 xl:w-6 xl:h-6" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>
          )}
          {/* Right Side - User Menu */}
          <div className="flex items-center space-x-2">
            {/* Notification Bell Icon */}
            {user && (
              <button
                onClick={() => setIsNotificationOpen(true)}
                className="relative p-2 rounded-full hover:bg-primary-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-300"
                aria-label="Open notifications"
              >
                <Bell className="w-6 h-6 text-primary-600" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 h-4 w-4 rounded-full ring-2 ring-white bg-red-500 text-xs text-white flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            )}
            {(!user || user.role === 'buyer') && (
              <>
                {isUsernameBrandPage && (
                  <button
                    onClick={handleSellerSearchIconClick}
                    className="p-2 rounded-full hover:bg-primary-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-300"
                    aria-label="Search seller products"
                  >
                    <Search className="w-6 h-6 text-primary-600" />
                  </button>
                )}
                <WishlistIcon />
                <CartIcon />
              </>
            )}
            {!user && (
              <>
                <Link
                  href={`/login${currentPath ? `?redirect=${encodeURIComponent(currentPath)}` : ''}`}
                  className="bg-primary-100 text-primary-700 hover:bg-primary-200 rounded-xl px-3 xl:px-4 py-1 xl:py-2 font-bold text-base xl:text-lg transition-colors"
                  style={{ boxShadow: 'none' }}
                >
                  Sign In
                </Link>
                <Link
                  href={`/register${currentPath ? `?redirect=${encodeURIComponent(currentPath)}` : ''}`}
                  className="bg-primary-600 border border-primary-600 text-white hover:bg-primary-700 hover:border-primary-700 rounded-xl px-3 xl:px-4 py-1 xl:py-2 font-bold text-base xl:text-lg transition-colors shadow-lg"
                  style={{ boxShadow: 'none' }}
                >
                  Register
                </Link>
              </>
            )}
            {user && (
              <>
                <UserAvatar user={user} size="md" />
                <button
                  onClick={handleLogout}
                  className="bg-neutral-100 text-neutral-700 hover:bg-neutral-200 rounded-xl px-3 xl:px-4 py-1 xl:py-2 font-bold text-base xl:text-lg transition-colors flex items-center space-x-1"
                >
                  <LogOut className="w-5 h-5 xl:w-6 xl:h-6" />
                  <span className="hidden xl:inline">Logout</span>
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* Tablet and Mobile header (combined) */}
        <div className="flex lg:hidden w-full min-w-0 items-center justify-between py-2 px-3 sm:px-4">
          <Link href={getNavHref('/')} className="flex items-center">
            <Image
              src={LOGO_SRC}
              alt="Zaryah"
              width={180}
              height={54}
              className="h-8 sm:h-10 w-auto"
              priority
            />
          </Link>
          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            {returnToSeller && isUsernameBrandPage && (
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.href = returnToSeller
                  }
                }}
                className="rounded-full border border-primary-200 bg-white px-2.5 py-1 text-xs font-semibold text-primary-700"
              >
                Back
              </button>
            )}
            {/* Notification Bell Icon */}
            {user && (
              <button
                onClick={() => setIsNotificationOpen(true)}
                className="relative p-2 rounded-full hover:bg-primary-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-300"
                aria-label="Open notifications"
              >
                <Bell className="w-6 h-6 text-primary-600" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 h-4 w-4 rounded-full ring-2 ring-white bg-red-500 text-xs text-white flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            )}
            {(!user || user.role === 'buyer') && (
              <>
                {isUsernameBrandPage && (
                  <button
                    onClick={handleSellerSearchIconClick}
                    className="p-2 rounded-full hover:bg-primary-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-300"
                    aria-label="Search seller products"
                  >
                    <Search className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600" />
                  </button>
                )}
                <WishlistIcon />
                <CartIcon />
              </>
            )}
            {!isUsernameBrandPage && (
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 text-neutral-900 hover:text-neutral-100 hover:bg-neutral-100 rounded-xl transition-all"
              >
                {isMenuOpen ? <X className="w-5 h-5 xl:w-6 xl:h-6" /> : <Menu className="w-5 h-5 xl:w-6 xl:h-6" />}
              </button>
            )}
          </div>
        </div>
        
        {/* Mobile search bar row - hide on shop and orders pages */}
        {pathname !== '/shop' && pathname !== '/orders' && !isUsernameBrandPage && (
          <div className="md:hidden w-full px-4 pb-3 relative">
            <form onSubmit={handleSearchSubmit}>
              <div className="flex items-center bg-white rounded-2xl px-4 py-3 border border-neutral-200 shadow focus-within:ring-2 focus-within:ring-primary-300 transition-all">
                <svg className="w-5 h-5 text-neutral-400 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                <input 
                  type="text" 
                  placeholder="Search our marketplace" 
                  className="bg-transparent outline-none flex-1 text-base text-neutral-700 placeholder-neutral-400"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => searchQuery && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                />
              </div>
            </form>
            
            {/* Search Suggestions Dropdown */}
            {showSuggestions && searchSuggestions.length > 0 && (
              <div className="absolute left-4 right-4 top-full mt-1 bg-white rounded-lg shadow-lg border border-neutral-200 overflow-hidden z-50">
                {searchSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors text-sm text-charcoal-700 border-b border-neutral-100 last:border-0 flex items-center gap-2"
                  >
                    <Search className="w-4 h-4 text-charcoal-400" />
                    <span>{suggestion}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Mobile/Tablet nav dropdown */}
        {isMenuOpen && !isUsernameBrandPage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:hidden bg-white border-t border-neutral-200 px-4 py-4 shadow-xl rounded-b-2xl z-50"
            style={{ position: 'absolute', left: 0, right: 0, top: '100%' }}
          >
            <nav className="space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                
                if (item.isAnchor) {
                  return (
                    <button
                      key={item.name}
                      onClick={() => {
                        setIsMenuOpen(false)
                        if (item.onClick) {
                          item.onClick()
                        }
                      }}
                      className={`flex items-center space-x-4 px-6 py-3 rounded-xl transition-all text-base w-full text-left ${
                        'text-neutral-900 hover:text-primary-700 hover:bg-neutral-100'
                      }`}
                    >
                      <Icon className="w-6 h-6" />
                      <span className="font-semibold">{item.name}</span>
                    </button>
                  )
                }
                
                return (
                  <Link
                    key={item.name}
                    href={getNavHref(item.href)}
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center space-x-4 px-6 py-3 rounded-xl transition-all text-base ${
                      isActive
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-neutral-900 hover:text-primary-700 hover:bg-neutral-100'
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                    <span className="font-semibold">{item.name}</span>
                  </Link>
                )
              })}
              {user ? (
                <>
                  <div className="px-6 py-3 border-b border-neutral-200">
                    <UserAvatar user={user} size="lg" showName={true} />
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-4 px-6 py-3 rounded-xl text-neutral-900 hover:text-primary-700 hover:bg-neutral-100 w-full transition-all text-base"
                  >
                    <LogOut className="w-6 h-6" />
                    <span className="font-semibold">Logout</span>
                  </button>
                </>
              ) : (
                <div className="flex space-x-4 pt-2">
                  <Link
                    href={`/login${currentPath ? `?redirect=${encodeURIComponent(currentPath)}` : ''}`}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex-1 text-center text-neutral-900 hover:text-primary-700 font-semibold px-6 py-3 rounded-xl hover:bg-neutral-100 transition-all text-base"
                  >
                    Login
                  </Link>
                  <Link
                    href={`/register${currentPath ? `?redirect=${encodeURIComponent(currentPath)}` : ''}`}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex-1 text-center bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-xl transition-all font-semibold shadow-soft text-base"
                  >
                    Register
                  </Link>
                </div>
              )}
            </nav>
          </motion.div>
        )}
      </header>
      )}
      {/* Notification Sidebar */}
      <NotificationSidebar
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        onUnreadCountChange={setUnreadCount}
      />
      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
      {/* Cart Sidebar */}
      <CartSidebar />

      {/* Footer */}
      <footer className="bg-neutral-50 border-t border-primary-100 mt-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 lg:py-6">
          <div className="max-w-2xl">
            <div className="flex items-center mb-2">
              <Image
                src={LOGO_SRC}
                alt="Zaryah"
                width={280}
                height={84}
                className="h-12 w-auto"
              />
            </div>
            <p className="text-neutral-600 text-sm lg:text-base leading-relaxed">
              Thoughtful gifting that feels personal, supports independent artisans, and turns every purchase into a meaningful connection.
            </p>
          </div>

          <div className="border-t border-primary-100 mt-4 pt-3 flex flex-col md:flex-row justify-between items-center">
            <p className="text-xs lg:text-sm text-neutral-600 mb-2 md:mb-0 text-center md:text-left">
              © {new Date().getFullYear()} Zaryah. Curated with heart.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs lg:text-sm text-neutral-600">
              <Link href="/contact-us" className="hover:text-neutral-800 transition-colors">Contact Us</Link>
              <Link href="/terms" className="hover:text-neutral-800 transition-colors">Terms &amp; Conditions</Link>
              <Link href="/privacy-policy" className="hover:text-neutral-800 transition-colors">Privacy Policy</Link>
              <Link href="/refund-policy" className="hover:text-neutral-800 transition-colors">Refund Policy</Link>
              <Link href="/return-policy" className="hover:text-neutral-800 transition-colors">Return Policy</Link>
              <Link href="/shipping-policy" className="hover:text-neutral-800 transition-colors">Shipping Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
