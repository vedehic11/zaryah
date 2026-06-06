// API Service for Next.js API routes with Supabase Auth
// This replaces the old Express.js backend API calls

import { supabaseClient } from '@/lib/supabase-client'

class ApiService {
  constructor() {
    // Use relative paths for Next.js API routes
    this.baseURL = '/api'
  }

  // Helper method to get Supabase auth token
  async getAuthToken() {
    try {
      const { data: { session }, error } = await supabaseClient.auth.getSession()

      if (error) {
        throw error
      }

      if (session?.expires_at) {
        const expiresAtMs = session.expires_at * 1000
        if (expiresAtMs <= Date.now() + 60_000) {
          const { data: refreshed, error: refreshError } = await supabaseClient.auth.refreshSession()
          if (refreshError) {
            throw refreshError
          }
          return refreshed?.session?.access_token || null
        }
      }

      if (session?.access_token) {
        return session.access_token
      }

      return this.getTokenFromStorage()
    } catch (error) {
      const message = String(error?.message || error || '').toLowerCase()
      const isInvalidRefreshToken = message.includes('invalid refresh token') || message.includes('refresh token not found')

      if (isInvalidRefreshToken && typeof window !== 'undefined') {
        window.localStorage.removeItem('zaryah-auth-token')
        this.clearAuthCookies()
      }

      return this.getTokenFromStorage()
    }
  }

  getTokenFromStorage() {
    if (typeof window === 'undefined') return null

    const raw = window.localStorage.getItem('zaryah-auth-token')
    const token = this.extractAccessToken(raw)
    if (token) return token

    const cookieToken = this.extractAccessTokenFromCookie('zaryah-auth-token')
    if (cookieToken) return cookieToken

    const chunkedToken = this.extractAccessTokenFromChunkedCookie('zaryah-auth-token')
    if (chunkedToken) return chunkedToken

    return null
  }

  extractAccessToken(rawValue) {
    if (!rawValue) return null
    try {
      const parsed = JSON.parse(rawValue)
      return parsed?.access_token || parsed?.currentSession?.access_token || null
    } catch {
      return rawValue
    }
  }

  extractAccessTokenFromCookie(cookieKey) {
    if (typeof document === 'undefined') return null
    const match = document.cookie.match(new RegExp(`(?:^|; )${cookieKey}=([^;]*)`))
    if (!match) return null
    return this.extractAccessToken(decodeURIComponent(match[1]))
  }

  extractAccessTokenFromChunkedCookie(cookieKey) {
    if (typeof document === 'undefined') return null
    const chunkCountMatch = document.cookie.match(new RegExp(`(?:^|; )${cookieKey}\\.chunks=([^;]*)`))
    if (!chunkCountMatch) return null
    const chunkCount = Number(decodeURIComponent(chunkCountMatch[1]))
    if (!chunkCount) return null

    let combined = ''
    for (let i = 0; i < chunkCount; i += 1) {
      const partMatch = document.cookie.match(new RegExp(`(?:^|; )${cookieKey}\\.${i}=([^;]*)`))
      if (!partMatch) return null
      combined += decodeURIComponent(partMatch[1])
    }

    try {
      const decoded = atob(combined)
      return this.extractAccessToken(decoded)
    } catch {
      return null
    }
  }

  clearAuthCookies() {
    if (typeof document === 'undefined') return
    const cookieKey = 'zaryah-auth-token'
    const chunkCountMatch = document.cookie.match(new RegExp(`(?:^|; )${cookieKey}\\.chunks=([^;]*)`))
    const chunkCount = chunkCountMatch ? Number(decodeURIComponent(chunkCountMatch[1])) : 0

    const expire = (name) => {
      document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`
    }

    if (chunkCount) {
      for (let i = 0; i < chunkCount; i += 1) {
        expire(`${cookieKey}.${i}`)
      }
      expire(`${cookieKey}.chunks`)
    }

    expire(cookieKey)
  }

  // Helper method to handle API calls
  // Supabase Auth: send token in Authorization header
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`
    const { silentErrors = false, timeoutMs, _retryAuth = false, ...requestOptions } = options
    
    // Get auth token
    const token = await this.getAuthToken()
    
    const config = {
      credentials: 'include', // Include cookies
      headers: {
        'Content-Type': 'application/json',
        ...requestOptions.headers,
      },
      ...requestOptions,
    }

    // Always fetch fresh data for GET requests (critical for live order status updates)
    if (!config.method || config.method.toUpperCase() === 'GET') {
      config.cache = 'no-store'
      config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
      config.headers['Pragma'] = 'no-cache'
      config.headers['Expires'] = '0'
    }
    
    // Add Authorization header if token exists
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    
    // Remove Content-Type for FormData (browser sets it automatically)
    if (requestOptions.body instanceof FormData) {
      delete config.headers['Content-Type']
    }

    // Add timeout protection so screens do not buffer forever on stalled network calls.
    const controller = new AbortController()
    const externalSignal = requestOptions.signal
    const defaultTimeout = requestOptions.body instanceof FormData ? 45000 : 15000
    const requestTimeoutMs = typeof timeoutMs === 'number' ? timeoutMs : defaultTimeout

    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort(externalSignal.reason)
      } else {
        externalSignal.addEventListener('abort', () => controller.abort(externalSignal.reason), { once: true })
      }
    }

    config.signal = controller.signal

    const timeoutId = setTimeout(() => {
      controller.abort(new Error(`Request timeout after ${requestTimeoutMs}ms`))
    }, requestTimeoutMs)

    try {
      if (!silentErrors) {
        console.log(`API Request: ${requestOptions.method || 'GET'} ${url}`)
      }
      const response = await fetch(url, config)
      
      // Check if response has content before parsing JSON
      const contentType = response.headers.get('content-type')
      let data = null
      
      if (contentType && contentType.includes('application/json')) {
        const text = await response.text()
        if (text && text.trim()) {
          data = JSON.parse(text)
        }
      }

      if (!response.ok) {
        if (response.status === 401 && !_retryAuth) {
          try {
            const { data: refreshed } = await supabaseClient.auth.refreshSession()
            if (refreshed?.session?.access_token) {
              return this.request(endpoint, { ...options, _retryAuth: true })
            }
          } catch (refreshError) {
            if (!silentErrors) {
              console.error('Auth refresh failed:', refreshError)
            }
          }
        }
        const errorMsg = data?.error || data?.message || `HTTP ${response.status}: ${response.statusText}`
        const isExpected = typeof errorMsg === 'string' && /insufficient\s+stock/i.test(errorMsg)
        if (!silentErrors && !isExpected) {
          console.error(`API Error [${url}]:`, errorMsg)
        }
        throw new Error(errorMsg)
      }

      if (!silentErrors) {
        console.log(`API Success [${url}]:`, data?.length ? `${data.length} items` : 'OK')
      }
      return data
    } catch (error) {
      if (error?.name === 'AbortError') {
        if (!silentErrors) {
          console.error(`API Timeout/Error [${url}]:`, error)
        }
        throw new Error('Request timed out. Please try again.')
      }

      // Check if it's a network error
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        if (!silentErrors) {
          console.error('Network Error: Cannot connect to API server. Is the dev server running on port 3000?')
        }
        throw new Error('Cannot connect to server. Please check if the application is running.')
      }
      if (!silentErrors) {
        console.error('API Error:', error)
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // Product endpoints
  async getApprovedProducts() {
    try {
      return await this.request('/products', { method: 'GET' })
    } catch (error) {
      const fallback = await this.fetchPublicProducts()
      if (fallback.length > 0) return fallback
      throw error
    }
  }

  async getProducts(filters = {}) {
    const params = new URLSearchParams(filters)
    return this.request(`/products?${params.toString()}`, { method: 'GET' })
  }

  async fetchPublicProducts() {
    if (typeof window === 'undefined') return []

    const selectFields = `
      *,
      sellers:seller_id (
        id,
        business_name,
        full_name,
        username,
        city,
        business_address,
        business_description,
        allow_cod
      )
    `

    const isArchivedColumnMissing = (error) => {
      const message = String(error?.message || error || '').toLowerCase()
      return message.includes('column products.archived does not exist') ||
        message.includes('could not find the') && message.includes('archived') ||
        message.includes('archived column')
    }

    const runQuery = async (skipArchivedFilter) => {
      let query = supabaseClient
        .from('products')
        .select(selectFields)
        .eq('status', 'approved')

      if (!skipArchivedFilter) {
        query = query.eq('archived', false)
      }

      return query.order('created_at', { ascending: false })
    }

    try {
      let { data, error } = await runQuery(false)
      if (error && isArchivedColumnMissing(error)) {
        ;({ data, error } = await runQuery(true))
      }
      if (error) throw error
      return this.normalizeProducts(data || [])
    } catch (error) {
      console.error('Public product fallback failed:', error)
      return []
    }
  }

  normalizeProducts(products = []) {
    return (products || []).map(product => {
      const seller = product.sellers || {}
      const ratings = seller.seller_reviews || []
      const avgRating = ratings.length > 0
        ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
        : 0
      const categories = Array.isArray(product.categories) ? product.categories :
        (product.category ? [product.category] : [])
      const sections = Array.isArray(product.sections) ? product.sections :
        (product.section ? [product.section] : [])

      return {
        id: product.id,
        name: product.name,
        description: product.description,
        price: parseFloat(product.price),
        archived: Boolean(product.archived),
        images: product.images || [],
        video_url: product.video_url,
        categories,
        category: categories[0] || null,
        sections,
        section: sections[0] || null,
        weight: product.weight,
        stock: product.stock,
        customisable: product.customisable,
        custom_questions: product.custom_questions,
        features: product.features || [],
        delivery_time_min: product.delivery_time_min,
        delivery_time_max: product.delivery_time_max,
        delivery_time_unit: product.delivery_time_unit,
        instant_delivery: product.instant_delivery,
        instantDeliveryEligible: product.instant_delivery,
        mrp: product.mrp ? parseFloat(product.mrp) : null,
        size_options: product.size_options || [],
        size_price_options: product.size_price_options || [],
        sizePriceOptions: product.size_price_options || [],
        material: product.material,
        care_instructions: product.care_instructions,
        return_available: product.return_available,
        return_days: product.return_days,
        cod_available: product.cod_available,
        two_way_delivery: product.two_way_delivery,
        twoWayDelivery: product.two_way_delivery,
        color_options: product.color_options || [],
        colorOptions: product.color_options || [],
        legal_disclaimer: product.legal_disclaimer,
        size_charts: product.size_charts || [],
        sizeCharts: product.size_charts || [],
        size_chart_url: null,
        sizeChartUrl: null,
        is_genuine: product.is_genuine,
        is_quality_checked: product.is_quality_checked,
        status: product.status,
        createdAt: product.created_at,
        created_at: product.created_at,
        averageRating: parseFloat(avgRating),
        ratingCount: ratings.length,
        seller_id: product.seller_id,
        sellerId: product.seller_id,
        seller: {
          id: seller.id,
          business_name: seller.business_name,
          full_name: seller.full_name,
          businessName: seller.business_name,
          sellerName: seller.business_name,
          username: seller.username,
          city: seller.city,
          businessAddress: seller.business_address,
          businessDescription: seller.business_description,
          allowCod: seller.allow_cod !== false
        }
      }
    })
  }

  async getProduct(id) {
    return this.request(`/products/${id}`, { method: 'GET' })
  }

  async createProduct(productData) {
    const formData = new FormData()
    Object.keys(productData).forEach(key => {
      if (productData[key] !== null && productData[key] !== undefined) {
        if (key === 'images' && Array.isArray(productData[key])) {
          productData[key].forEach((file) => {
            formData.append(`images`, file)
          })
        } else {
          formData.append(key, productData[key])
        }
      }
    })
    return this.request('/products', { method: 'POST', body: formData })
  }

  async updateProduct(id, productData) {
    const hasBinaryImages = Array.isArray(productData?.images) && productData.images.some(file => file instanceof File || file instanceof Blob)

    if (hasBinaryImages) {
      const formData = new FormData()
      Object.keys(productData).forEach(key => {
        if (productData[key] !== null && productData[key] !== undefined) {
          if (key === 'images' && Array.isArray(productData[key])) {
            productData[key].forEach((file) => {
              formData.append('images', file)
            })
          } else {
            formData.append(key, productData[key])
          }
        }
      })

      return this.request(`/products/${id}`, { method: 'PUT', body: formData })
    }

    return this.request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    })
  }

  async deleteProduct(id) {
    return this.request(`/products/${id}`, { method: 'DELETE' })
  }

  async unarchiveProduct(id) {
    return this.request(`/products/${id}/unarchive`, { method: 'POST' })
  }

  // Cart endpoints
  async getCart() {
    return this.request('/cart', { method: 'GET' })
  }

  async addToCart(productId, quantity = 1) {
    return this.request('/cart', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity }),
    })
  }

  async addItemToCart(itemData) {
    return this.request('/cart', {
      method: 'POST',
      body: JSON.stringify(itemData),
    })
  }

  async updateCartItem(itemId, updates) {
    return this.request(`/cart/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  async removeItemFromCart(itemId) {
    return this.request(`/cart/items/${itemId}`, { method: 'DELETE' })
  }

  async removeFromCart(itemId) {
    return this.removeItemFromCart(itemId)
  }

  async clearCart() {
    return this.request('/cart', { method: 'DELETE' })
  }

  async testCart() {
    // Test endpoint - may not exist, return mock response
    try {
      return await this.request('/cart/test', { method: 'GET' })
    } catch (error) {
      return { success: false, message: 'Cart test endpoint not available' }
    }
  }

  // Order endpoints
  async createOrder(orderData) {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    })
  }

  async getOrders(userType = null) {
    const params = userType ? `?userType=${userType}` : ''
    return this.request(`/orders${params}`, { method: 'GET' })
  }

  async getOrderById(orderId) {
    return this.request(`/orders/${orderId}`, { method: 'GET' })
  }

  async updateOrderStatus(orderId, status) {
    return this.request(`/orders/${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  }

  async syncOrderShipmentStatus(orderId) {
    return this.request(`/orders/${orderId}/sync-status`, {
      method: 'POST'
    })
  }

  async syncAllOrderShipmentStatuses(payload = {}) {
    return this.request('/orders/sync-all', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  // Address endpoints
  async getUserAddresses(userId = null) {
    // userId is optional - API will use authenticated user
    return this.request('/addresses', { method: 'GET' })
  }

  async addAddress(userId, addressData) {
    // userId is optional - API will use authenticated user
    return this.request('/addresses', {
      method: 'POST',
      body: JSON.stringify(addressData),
    })
  }

  async updateAddress(addressId, addressData) {
    return this.request(`/addresses/${addressId}`, {
      method: 'PUT',
      body: JSON.stringify(addressData),
    })
  }

  async deleteAddress(addressId) {
    return this.request(`/addresses/${addressId}`, { method: 'DELETE' })
  }

  // Review endpoints
  async getSellerReviews(sellerId) {
    return this.request(`/reviews?sellerId=${sellerId}`, { method: 'GET' })
  }

  async getReviews(sellerId = null) {
    const url = sellerId ? `/reviews?sellerId=${sellerId}` : '/reviews'
    return this.request(url, { method: 'GET' })
  }

  async addReview(reviewData) {
    return this.request('/reviews', {
      method: 'POST',
      body: JSON.stringify(reviewData),
    })
  }

  async createReview(reviewData) {
    return this.addReview(reviewData)
  }

  // Seller endpoints
  async getSellers() {
    try {
      return await this.request('/sellers', { method: 'GET' })
    } catch (error) {
      const fallback = await this.fetchPublicSellers()
      if (fallback.length > 0) return fallback
      throw error
    }
  }

  async getSellerById(sellerId) {
    return this.request(`/sellers?id=${sellerId}`, { method: 'GET' })
  }

  async fetchPublicSellers() {
    if (typeof window === 'undefined') return []

    try {
      const { data, error } = await supabaseClient
        .from('sellers')
        .select(`
          id,
          business_name,
          username,
          cover_photo,
          business_description,
          story,
          featured_story,
          hide_from_artisans,
          city,
          primary_mobile,
          instagram,
          facebook,
          x,
          linkedin,
          registration_date,
          users!sellers_id_fkey (
            id,
            name,
            profile_photo,
            is_approved
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const approved = (data || []).filter(item => item?.users?.is_approved)
      const visible = approved.filter(item => !item?.hide_from_artisans)
      return visible
    } catch (error) {
      console.error('Public seller fallback failed:', error)
      return []
    }
  }

  async getSellerByUsername(username) {
    return this.request(`/sellers/username/${username}`, { method: 'GET' })
  }

  async registerSeller(sellerData) {
    console.log('API Service: registerSeller called with data:', Object.keys(sellerData))
    const formData = new FormData()
    Object.keys(sellerData).forEach(key => {
      if (sellerData[key] instanceof File) {
        console.log(`Adding file field: ${key}`)
        formData.append(key, sellerData[key])
      } else if (sellerData[key] !== null && sellerData[key] !== undefined) {
        console.log(`Adding form field: ${key} = ${sellerData[key]}`)
        formData.append(key, sellerData[key])
      }
    })
    console.log('Sending seller registration request to /api/sellers')
    return this.request('/sellers', { method: 'POST', body: formData })
  }

  async checkUsername(username) {
    return this.request(`/sellers/username/check?username=${username}`, { method: 'GET' })
  }

  async getSellerSections() {
    return this.request('/seller-sections', { method: 'GET' })
  }

  async createSellerSection(name, imageUrl = '') {
    return this.request('/seller-sections', {
      method: 'POST',
      body: JSON.stringify({
        name,
        image_url: imageUrl || undefined,
      }),
    })
  }

  async deleteSellerSection(id) {
    return this.request(`/seller-sections?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  }

  async updateSellerSection(id, name = '', imageUrl = '') {
    const body = {}
    if (name) body.name = name
    if (imageUrl) body.image_url = imageUrl
    
    return this.request(`/seller-sections?id=${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  }

  // Admin endpoints
  async getPendingProducts() {
    return this.request('/admin/products/pending', { method: 'GET' })
  }

  async approveProduct(productId) {
    return this.request(`/admin/products/${productId}/approve`, { method: 'POST' })
  }

  async getSellersForAdmin() {
    return this.request('/admin/sellers', { method: 'GET' })
  }

  async approveSeller(sellerId, isApproved = true) {
    return this.request(`/admin/sellers/${sellerId}/approve`, { 
      method: 'POST',
      body: JSON.stringify({ isApproved })
    })
  }

  // Notification endpoints
  async getNotifications() {
    return this.request('/notifications', { method: 'GET' })
  }

  async markNotificationAsRead(notificationId) {
    return this.request(`/notifications/${notificationId}`, {
      method: 'PATCH',
      body: JSON.stringify({ read: true }),
    })
  }

  async markAllNotificationsAsRead() {
    return this.request('/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ read: true }),
    })
  }

  async deleteNotification(notificationId) {
    return this.request(`/notifications/${notificationId}`, {
      method: 'DELETE',
    })
  }

  async deleteAllNotifications() {
    return this.request('/notifications', {
      method: 'DELETE',
    })
  }

  async getNotificationCount() {
    return this.request('/notifications/count', { method: 'GET' })
  }

  // Upload endpoint
  async uploadFile(file, folder = 'general') {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', folder)
    return this.request('/upload', { method: 'POST', body: formData })
  }

  // Payment endpoints
  async createPaymentOrder(data) {
    return this.request('/payment/create-order', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async verifyPayment(paymentData) {
    return this.request('/payment/verify', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    })
  }

  // Wallet endpoints
  async getWallet() {
    return this.request('/wallet', { method: 'GET' })
  }

  async requestWithdrawal(withdrawalData) {
    return this.request('/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify(withdrawalData),
    })
  }

  async getWithdrawals() {
    return this.request('/wallet/withdraw', { method: 'GET' })
  }

  // Admin wallet endpoints
  async getAdminWithdrawals(status = null) {
    const params = status ? `?status=${status}` : ''
    return this.request(`/admin/withdrawals${params}`, { method: 'GET' })
  }

  async approveWithdrawal(withdrawalId, action, reason = null, manualTransactionId = null) {
    return this.request(`/admin/withdrawals/${withdrawalId}/approve`, {
      method: 'POST',
      body: JSON.stringify({
        action,
        rejection_reason: reason,
        manual_transaction_id: manualTransactionId
      }),
    })
  }

  async getAdminEarnings(period = 'all', sellerId = null) {
    const params = new URLSearchParams()
    if (period) params.append('period', period)
    if (sellerId) params.append('seller_id', sellerId)
    return this.request(`/admin/earnings?${params.toString()}`, { method: 'GET' })
  }

  // Order status webhook
  async updateOrderStatusWebhook(orderId, status, trackingData = null) {
    return this.request('/webhooks/order-status', {
      method: 'POST',
      body: JSON.stringify({ order_id: orderId, status, tracking_data: trackingData }),
      headers: {
        'x-webhook-signature': process.env.NEXT_PUBLIC_WEBHOOK_SECRET || ''
      }
    })
  }

  // Support ticket endpoints
  async createSupportTicket(ticketData) {
    return this.request('/support/tickets', {
      method: 'POST',
      body: JSON.stringify(ticketData),
    })
  }

  async getSupportTickets() {
    return this.request('/support/tickets', { method: 'GET' })
  }

  async getOrdersForBuyer(buyerId) {
    return this.request(`/orders?userType=buyer`, { method: 'GET' })
  }

  async getOrdersForSeller(sellerId) {
    return this.request(`/orders?userType=seller`, { method: 'GET' })
  }

  async getSellerOrdersPaginated({ page = 1, pageSize = 20, status = 'all' } = {}) {
    const params = new URLSearchParams({
      userType: 'seller',
      paginated: 'true',
      page: String(page),
      pageSize: String(pageSize)
    })

    if (status && status !== 'all') {
      params.append('status', status)
    }

    return this.request(`/orders?${params.toString()}`, { method: 'GET' })
  }
}

// Create singleton instance
export const apiService = new ApiService()

// Export individual methods for convenience (legacy support)
export default apiService

