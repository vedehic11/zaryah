'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  Heart, 
  User, 
  Gift, 
  LogOut, 
  Menu, 
  X,
  Sparkles,
  Package,
  History,
  ShoppingBag,
  Bell,
  MessageSquare,
  Search
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useCart } from '../contexts/CartContext'
import { CartIcon } from './CartIcon'
import { WishlistIcon } from './WishlistIcon'
import { CartSidebar } from './CartSidebar'
import { NotificationCenter } from './NotificationCenter'
import ChatSupportButton from './ChatSupportButton'
import LocationDetectButton from './LocationDetectButton'
import { UserAvatar } from './UserAvatar'
import { apiService } from '../services/api'

// NotificationSidebar component (like CartSidebar)
function NotificationSidebar({ isOpen, onClose }) {
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
        <NotificationCenter />
      </div>
    </div>
  )
}

export const Layout = ({ children }) => {
  const { user, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchSuggestions, setSearchSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [products, setProducts] = useState([])
  const [productsLoaded, setProductsLoaded] = useState(false)
  // const { syncGuestCartToBackend } = useCart() // Removed automatic syncing

  // Load products for search suggestions only when needed
  const loadProducts = async () => {
    if (productsLoaded) return products
    try {
      const data = await apiService.getApprovedProducts()
      setProducts(data || [])
      setProductsLoaded(true)
      return data || []
    } catch (error) {
      console.error('Error loading products:', error)
      return []
    }
  }

  // Load unread notification count
  useEffect(() => {
    if (user && user.token) {
      loadUnreadCount()
    }
  }, [user])

  const loadUnreadCount = async () => {
    try {
      const response = await apiService.getNotificationCount()
      setUnreadCount(response.unreadCount || 0)
    } catch (error) {
      console.error('Error loading notification count:', error)
    }
  }

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

  const handleLogout = useCallback(() => {
    logout()
    router.push('/')
  }, [logout, router])

  // Handle search input change with debouncing - generate text suggestions from product names
  const handleSearchChange = async (e) => {
    const value = e.target.value
    setSearchQuery(value)
    
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
      router.push(`/shop?search=${encodeURIComponent(searchQuery)}`)
    }
  }

  // Handle suggestion click - just populate and search
  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion)
    setShowSuggestions(false)
    router.push(`/shop?search=${encodeURIComponent(suggestion)}`)
  }

  const getBuyerNavigation = useCallback(() => [
    { name: 'Home', href: '/', icon: Heart },
    { name: 'Shop', href: '/shop', icon: ShoppingBag },
    { name: 'Gift Suggester', href: '/gift-suggester', icon: Gift },
    { name: 'Hamper Builder', href: '/hamper-builder', icon: Package },
    ...(user ? [
      { name: 'Orders', href: '/orders', icon: History },
      { name: 'Support', href: '/support', icon: MessageSquare }
    ] : [])
  ], [user])

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

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Floating Buttons */}
      <ChatSupportButton />
      <LocationDetectButton />
      {/* Header */}
      <header className="bg-cream-50/95 backdrop-blur-md border-b border-cream-200 sticky top-0 z-50 shadow-lg">
        {/* Desktop header row */}
        <div className="hidden lg:flex w-full items-center justify-between py-4 px-4 xl:px-6">
          {/* Logo - Left Side */}
          <div className="flex-shrink-0 flex items-center justify-start">
            <Link href="/" className="flex items-center space-x-2">
              <span className="p-2 rounded-lg flex items-center justify-center transition-colors duration-200 bg-primary-100">
                <Sparkles className="w-6 h-6 xl:w-7 xl:h-7 transition-colors duration-200 text-primary-600" />
              </span>
              <span className="text-xl xl:text-2xl font-bold font-serif transition-colors duration-200 text-primary-700">
                Zaryah
              </span>
            </Link>
          </div>
          {/* Center Navigation */}
          <nav className="flex flex-1 justify-center gap-8 xl:gap-12">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  href={item.href}
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
                  <span className="absolute top-0 right-0 block h-4 w-4 rounded-full ring-2 ring-white bg-red-500 text-xs text-white flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            )}
            {(!user || user.role === 'buyer') && (
              <>
                <WishlistIcon />
                <CartIcon />
              </>
            )}
            {!user && (
              <>
                <Link
                  href="/login"
                  className="bg-primary-100 text-primary-700 hover:bg-primary-200 rounded-xl px-3 xl:px-4 py-1 xl:py-2 font-bold text-base xl:text-lg transition-colors"
                  style={{ boxShadow: 'none' }}
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
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
        <div className="flex lg:hidden w-full items-center justify-between py-3 px-3 xl:px-6">
          <Link href="/" className="flex items-center space-x-2">
            <span className="p-2 rounded-lg flex items-center justify-center transition-colors duration-200 bg-primary-100">
              <Sparkles className="w-5 h-5 xl:w-6 xl:h-6 transition-colors duration-200 text-primary-600" />
            </span>
            <span className="text-lg xl:text-xl font-bold font-serif transition-colors duration-200 text-primary-700">
              Zaryah
            </span>
          </Link>
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
                  <span className="absolute top-0 right-0 block h-4 w-4 rounded-full ring-2 ring-white bg-red-500 text-xs text-white flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            )}
            {(!user || user.role === 'buyer') && (
              <>
                <WishlistIcon />
                <CartIcon />
              </>
            )}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-neutral-900 hover:text-neutral-100 hover:bg-neutral-100 rounded-xl transition-all"
            >
              {isMenuOpen ? <X className="w-5 h-5 xl:w-6 xl:h-6" /> : <Menu className="w-5 h-5 xl:w-6 xl:h-6" />}
            </button>
          </div>
        </div>
        
        {/* Mobile search bar row - hide on shop and orders pages */}
        {pathname !== '/shop' && pathname !== '/orders' && (
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
        {isMenuOpen && (
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
                return (
                  <Link
                    key={item.name}
                    href={item.href}
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
                    href="/login"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex-1 text-center text-neutral-900 hover:text-primary-700 font-semibold px-6 py-3 rounded-xl hover:bg-neutral-100 transition-all text-base"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
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
      {/* Notification Sidebar */}
      <NotificationSidebar isOpen={isNotificationOpen} onClose={() => setIsNotificationOpen(false)} />
      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
      {/* Cart Sidebar */}
      <CartSidebar />

      {/* Footer */}
      <footer className="bg-neutral-50 border-t border-primary-100 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-16">
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {/* Brand */}
            <div className="col-span-2 md:col-span-2 lg:col-span-2">
              <div className="flex items-center space-x-3 mb-8">
                <div className="bg-primary-600 p-2 rounded-xl">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl lg:text-3xl font-bold text-neutral-800 font-serif">Zaryah</span>
              </div>
              <p className="text-neutral-600 mb-6 lg:mb-8 max-w-md text-base lg:text-lg leading-relaxed">
                Your path to meaningful connections through thoughtfully curated gifts. Every purchase tells a story 
                and supports passionate artisans on their creative journey.
              </p>
              <div className="flex flex-wrap gap-3">
                <div className="bg-secondary-100 text-secondary-700 px-3 lg:px-4 py-2 rounded-full text-sm lg:text-lg font-medium border border-secondary-200">
                  🌿 Mindful Choices
                </div>
                <div className="bg-primary-100 text-primary-700 px-3 lg:px-4 py-2 rounded-full text-sm lg:text-lg font-medium border border-primary-200">
                  ✨ Artisan Stories
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="font-semibold text-neutral-800 mb-4 lg:mb-6 text-lg lg:text-2xl">Explore</h3>
              <ul className="space-y-3">
                <li><Link href="/shop" className="text-neutral-600 hover:text-neutral-800 transition-colors text-sm lg:text-lg">Curated Collections</Link></li>
                <li><Link href="/gift-suggester" className="text-neutral-600 hover:text-neutral-800 transition-colors text-sm lg:text-lg">Gift Guidance</Link></li>
                <li><Link href="/hamper-builder" className="text-neutral-600 hover:text-neutral-800 transition-colors text-sm lg:text-lg">Create Bundles</Link></li>
                <li><Link href="/register" className="text-neutral-600 hover:text-neutral-800 transition-colors text-sm lg:text-lg">Join as Artisan</Link></li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h3 className="font-semibold text-neutral-800 mb-4 lg:mb-6 text-lg lg:text-2xl">Support</h3>
              <ul className="space-y-3">
                <li><a href="#" className="text-neutral-600 hover:text-neutral-800 transition-colors text-sm lg:text-lg">Help Center</a></li>
                <li><a href="#" className="text-neutral-600 hover:text-neutral-800 transition-colors text-sm lg:text-lg">Delivery Guide</a></li>
                <li><a href="#" className="text-neutral-600 hover:text-neutral-800 transition-colors text-sm lg:text-lg">Care & Returns</a></li>
                <li><a href="#" className="text-neutral-600 hover:text-neutral-800 transition-colors text-sm lg:text-lg">Connect With Us</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-primary-100 mt-8 lg:mt-12 pt-6 lg:pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm lg:text-lg text-neutral-600 mb-4 md:mb-0 text-center md:text-left">
              © 2024 Zaryah. Guiding paths to meaningful connections.
            </p>
            <div className="flex items-center space-x-4 lg:space-x-6 text-sm lg:text-lg text-neutral-600">
              <a href="#" className="hover:text-neutral-800 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-neutral-800 transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}