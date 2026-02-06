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
    const { data: { session } } = await supabaseClient.auth.getSession()
    return session?.access_token || null
  }

  // Helper method to handle API calls
  // Supabase Auth: send token in Authorization header
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`
    
    // Get auth token
    const token = await this.getAuthToken()
    
    const config = {
      credentials: 'include', // Include cookies
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    }
    
    // Add Authorization header if token exists
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    
    // Remove Content-Type for FormData (browser sets it automatically)
    if (options.body instanceof FormData) {
      delete config.headers['Content-Type']
    }

    try {
      console.log(`API Request: ${options.method || 'GET'} ${url}`)
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
        const errorMsg = data?.error || data?.message || `HTTP ${response.status}: ${response.statusText}`
        console.error(`API Error [${url}]:`, errorMsg)
        throw new Error(errorMsg)
      }

      console.log(`API Success [${url}]:`, data?.length ? `${data.length} items` : 'OK')
      return data
    } catch (error) {
      // Check if it's a network error
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.error('Network Error: Cannot connect to API server. Is the dev server running on port 3000?')
        throw new Error('Cannot connect to server. Please check if the application is running.')
      }
      console.error('API Error:', error)
      throw error
    }
  }

  // Product endpoints
  async getApprovedProducts() {
    return this.request('/products', { method: 'GET' })
  }

  async getProducts(filters = {}) {
    const params = new URLSearchParams(filters)
    return this.request(`/products?${params.toString()}`, { method: 'GET' })
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
    return this.request(`/products/${id}`, { method: 'PUT', body: formData })
  }

  async deleteProduct(id) {
    return this.request(`/products/${id}`, { method: 'DELETE' })
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

  async updateCartItem(itemId, itemData) {
    return this.request(`/cart/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(itemData),
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
  async getProductReviews(productId) {
    return this.request(`/reviews?productId=${productId}`, { method: 'GET' })
  }

  async getReviews(productId = null) {
    const url = productId ? `/reviews?productId=${productId}` : '/reviews'
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
    return this.request('/sellers', { method: 'GET' })
  }

  async getSellerById(sellerId) {
    return this.request(`/sellers?id=${sellerId}`, { method: 'GET' })
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
    return this.request('/payment/create-order', {
      method: 'PATCH',
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

  async approveWithdrawal(withdrawalId, action, reason = null) {
    return this.request(`/admin/withdrawals/${withdrawalId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ action, rejection_reason: reason }),
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
}

// Create singleton instance
export const apiService = new ApiService()

// Export individual methods for convenience (legacy support)
export default apiService

