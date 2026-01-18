// Shiprocket API integration
import crypto from 'crypto'

const SHIPROCKET_API_BASE = 'https://apiv2.shiprocket.in/v1/external'

let authToken = null
let tokenExpiry = null

/**
 * Authenticate with Shiprocket and get access token
 * Token is cached and reused until expiry
 */
async function authenticate() {
  // Return cached token if still valid
  if (authToken && tokenExpiry && Date.now() < tokenExpiry) {
    return authToken
  }

  const response = await fetch(`${SHIPROCKET_API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(`Shiprocket authentication failed: ${error.message || response.statusText}`)
  }

  const data = await response.json()
  authToken = data.token
  tokenExpiry = Date.now() + (10 * 60 * 60 * 1000) // Token valid for 10 hours
  
  return authToken
}

/**
 * Create a shipment on Shiprocket
 * @param {Object} params - Shipment parameters
 * @param {string} params.orderId - Order ID
 * @param {string} params.orderDate - Order date (YYYY-MM-DD)
 * @param {Object} params.pickupLocation - Seller pickup address
 * @param {Object} params.deliveryAddress - Buyer delivery address
 * @param {Array} params.items - Order items
 * @param {number} params.totalAmount - Order total amount
 * @param {string} params.paymentMethod - Payment method (COD/Prepaid)
 * @returns {Promise<Object>} Shipment details with AWB, courier, tracking URL
 */
export async function createShipment({
  orderId,
  orderDate,
  pickupLocation,
  deliveryAddress,
  items,
  totalAmount,
  paymentMethod
}) {
  const token = await authenticate()

  // Calculate total weight and dimensions
  const totalWeight = items.reduce((sum, item) => sum + ((item.weight || 0.5) * item.quantity), 0)
  const length = 10 // Default package dimensions in cm
  const breadth = 10
  const height = 10

  const shipmentData = {
    order_id: orderId,
    order_date: orderDate,
    pickup_location: pickupLocation.name || 'Primary',
    channel_id: '', // Leave empty for API orders
    comment: 'Order from Zaryah',
    billing_customer_name: deliveryAddress.name,
    billing_last_name: '',
    billing_address: deliveryAddress.address,
    billing_address_2: '',
    billing_city: deliveryAddress.city,
    billing_pincode: deliveryAddress.pincode,
    billing_state: deliveryAddress.state,
    billing_country: 'India',
    billing_email: deliveryAddress.email || 'customer@zaryah.com',
    billing_phone: deliveryAddress.phone,
    shipping_is_billing: true,
    shipping_customer_name: '',
    shipping_last_name: '',
    shipping_address: '',
    shipping_address_2: '',
    shipping_city: '',
    shipping_pincode: '',
    shipping_country: '',
    shipping_state: '',
    shipping_email: '',
    shipping_phone: '',
    order_items: items.map(item => ({
      name: item.name,
      sku: item.id || 'SKU001',
      units: item.quantity,
      selling_price: item.price,
      discount: 0,
      tax: 0,
      hsn: 0
    })),
    payment_method: paymentMethod === 'cod' ? 'COD' : 'Prepaid',
    shipping_charges: 0,
    giftwrap_charges: 0,
    transaction_charges: 0,
    total_discount: 0,
    sub_total: totalAmount,
    length,
    breadth,
    height,
    weight: totalWeight
  }

  const response = await fetch(`${SHIPROCKET_API_BASE}/orders/create/adhoc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(shipmentData)
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(`Shiprocket shipment creation failed: ${error.message || response.statusText}`)
  }

  const result = await response.json()
  
  if (!result.shipment_id) {
    throw new Error('Shiprocket did not return shipment_id')
  }

  console.log('✅ Shiprocket order created:', {
    order_id: result.order_id,
    shipment_id: result.shipment_id
  })

  // Step 2: Assign AWB (Air Waybill) code
  let awbCode = null
  let courierName = 'Pending Assignment'
  
  try {
    const awbResponse = await fetch(`${SHIPROCKET_API_BASE}/courier/assign/awb`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        shipment_id: result.shipment_id
      })
    })

    if (awbResponse.ok) {
      const awbResult = await awbResponse.json()
      awbCode = awbResult.response?.data?.awb_code || awbResult.awb_code
      courierName = awbResult.response?.data?.courier_name || awbResult.courier_name || courierName
      
      console.log('✅ AWB assigned:', { awbCode, courierName })

      // Step 3: Generate pickup request
      try {
        const pickupResponse = await fetch(`${SHIPROCKET_API_BASE}/courier/generate/pickup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            shipment_id: [result.shipment_id]
          })
        })

        if (pickupResponse.ok) {
          console.log('✅ Pickup request generated')
        } else {
          console.warn('⚠️ Pickup generation failed (non-critical)')
        }
      } catch (pickupError) {
        console.warn('⚠️ Pickup generation error (non-critical):', pickupError.message)
      }
    } else {
      const awbError = await awbResponse.json().catch(() => ({}))
      console.warn('⚠️ AWB assignment failed:', awbError.message || awbResponse.statusText)
    }
  } catch (awbError) {
    console.warn('⚠️ AWB assignment error:', awbError.message)
  }
  
  // Return normalized shipment data
  return {
    shipment_id: result.shipment_id,
    order_id: result.order_id,
    awb_code: awbCode,
    courier_name: courierName,
    status: result.status || 'PENDING',
    tracking_url: awbCode ? `https://shiprocket.co/tracking/${awbCode}` : null
  }
}

/**
 * Get shipment tracking details by AWB code
 * @param {string} awbCode - Shiprocket AWB code
 * @returns {Promise<Object>} Tracking details
 */
export async function getShipmentTracking(awbCode) {
  const token = await authenticate()

  const response = await fetch(`${SHIPROCKET_API_BASE}/courier/track/awb/${awbCode}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  if (!response.ok) {
    throw new Error('Failed to fetch shipment tracking')
  }

  return await response.json()
}

/**
 * Verify Shiprocket webhook signature
 * @param {string} payload - Webhook payload
 * @param {string} signature - Signature from x-shiprocket-signature header
 * @returns {boolean} True if signature is valid
 */
export function verifyWebhookSignature(payload, signature) {
  const secret = process.env.SHIPROCKET_WEBHOOK_SECRET
  if (!secret) {
    console.warn('SHIPROCKET_WEBHOOK_SECRET not configured')
    return false
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

/**
 * Map Shiprocket status to internal order status
 * @param {string} shiprocketStatus - Shiprocket shipment status
 * @returns {string|null} Internal order status or null if no change needed
 */
export function mapShiprocketStatus(shiprocketStatus) {
  const statusMap = {
    'Delivered': 'delivered',
    'RTO': 'cancelled',
    'RTO Delivered': 'cancelled',
    'Lost': 'cancelled',
    'Cancelled': 'cancelled',
    'Undelivered': 'cancelled'
  }

  return statusMap[shiprocketStatus] || null
}
