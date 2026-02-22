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
  // Check if credentials are configured
  if (!process.env.SHIPROCKET_EMAIL || !process.env.SHIPROCKET_PASSWORD) {
    throw new Error(
      'Shiprocket credentials not configured. ' +
      'Please set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD environment variables. ' +
      'Get credentials from: https://app.shiprocket.in/seller/settings/api'
    )
  }

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
 * Add or update pickup location in Shiprocket
 * This is required before creating shipments
 */
async function ensurePickupLocation(pickupLocation) {
  const token = await authenticate()
  
  // Check if location already exists
  try {
    const listResponse = await fetch(`${SHIPROCKET_API_BASE}/settings/company/pickup`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (listResponse.ok) {
      const locations = await listResponse.json()
      const existing = locations.data?.shipping_address?.find(
        loc => loc.pickup_location === (pickupLocation.name || 'Primary')
      )
      
      if (existing) {
        console.log('✅ Pickup location already exists:', pickupLocation.name)
        return pickupLocation.name || 'Primary'
      }
    }
  } catch (error) {
    console.warn('Could not check existing pickup locations:', error.message)
  }
  
  // Create new pickup location
  const addResponse = await fetch(`${SHIPROCKET_API_BASE}/settings/company/addpickup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      pickup_location: pickupLocation.name || 'Primary',
      name: pickupLocation.contactName || 'Zaryah Seller',
      email: pickupLocation.email || 'seller@zaryah.com',
      phone: pickupLocation.phone || '9999999999',
      address: pickupLocation.address,
      address_2: '',
      city: pickupLocation.city,
      state: pickupLocation.state,
      country: 'India',
      pin_code: pickupLocation.pincode
    })
  })
  
  if (!addResponse.ok) {
    const error = await addResponse.json().catch(() => ({}))
    console.warn('⚠️ Could not add pickup location:', error.message || addResponse.statusText)
    // Don't throw - proceed with default location
  } else {
    console.log('✅ Pickup location added:', pickupLocation.name)
  }
  
  return pickupLocation.name || 'Primary'
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

  // Ensure pickup location exists in Shiprocket
  await ensurePickupLocation(pickupLocation)

  // Calculate total weight and dimensions
  // Weight is stored in grams in the database, but Shiprocket expects kg
  const totalWeight = items.reduce((sum, item) => {
    const weightInGrams = item.weight || 500; // Default 500g if not specified
    const weightInKg = weightInGrams / 1000;
    return sum + (weightInKg * item.quantity);
  }, 0);
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
    shipping_customer_name: deliveryAddress.name,
    shipping_last_name: '',
    shipping_address: deliveryAddress.address,
    shipping_address_2: '',
    shipping_city: deliveryAddress.city,
    shipping_pincode: deliveryAddress.pincode,
    shipping_country: 'India',
    shipping_state: deliveryAddress.state,
    shipping_email: deliveryAddress.email || 'customer@zaryah.com',
    shipping_phone: deliveryAddress.phone,
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
 * Calculate shipping rates using Shiprocket's serviceability API
 * @param {Object} params - Rate calculation parameters
 * @param {string} params.pickupPincode - Seller pickup pincode
 * @param {string} params.deliveryPincode - Buyer delivery pincode
 * @param {number} params.weight - Total package weight in kg
 * @param {number} params.codAmount - COD amount (0 for prepaid)
 * @returns {Promise<Array>} Available courier options with rates
 */
export async function calculateShippingRates({
  pickupPincode,
  deliveryPincode,
  weight = 0.5,
  codAmount = 0
}) {
  const token = await authenticate()

  // Default dimensions (10x10x10 cm)
  const length = 10
  const breadth = 10
  const height = 10

  const params = new URLSearchParams({
    pickup_postcode: pickupPincode,
    delivery_postcode: deliveryPincode,
    weight: weight.toString(),
    length: length.toString(),
    breadth: breadth.toString(),
    height: height.toString(),
    cod: codAmount > 0 ? '1' : '0'
  })

  if (codAmount > 0) {
    params.append('declared_value', codAmount.toString())
  }

  const response = await fetch(
    `${SHIPROCKET_API_BASE}/courier/serviceability/?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(`Shiprocket serviceability check failed: ${error.message || response.statusText}`)
  }

  const result = await response.json()

  if (!result.data || !result.data.available_courier_companies) {
    throw new Error('No courier services available for this route')
  }

  // Return sorted by rate (cheapest first)
  const couriers = result.data.available_courier_companies
    .filter(courier => courier.freight_charge !== null)
    .map(courier => ({
      courier_name: courier.courier_name,
      courier_company_id: courier.courier_company_id,
      freight_charge: parseFloat(courier.freight_charge),
      cod_charge: parseFloat(courier.cod_charges || 0),
      total_charge: parseFloat(courier.rate || courier.freight_charge),
      estimated_delivery_days: courier.estimated_delivery_days || courier.etd || 'N/A',
      is_surface: courier.is_surface || false,
      min_weight: courier.min_weight || 0,
      rating: courier.rating || 0
    }))
    .sort((a, b) => a.total_charge - b.total_charge)

  return couriers
}

/**
 * Get the cheapest shipping rate for a route
 * @param {Object} params - Same as calculateShippingRates
 * @returns {Promise<number>} Cheapest delivery charge (includes ₹10 markup)
 */
export async function getCheapestShippingRate(params) {
  try {
    const couriers = await calculateShippingRates(params)
    if (couriers.length === 0) {
      // Fallback to standard rate + markup
      return 50 + 10
    }
    // Add ₹10 hidden markup to Shiprocket rate
    return Math.ceil(couriers[0].total_charge) + 10
  } catch (error) {
    console.error('Error fetching shipping rates:', error)
    // Fallback to standard rate + markup on error
    return 50 + 10
  }
}

/**
 * Get shipment details by shipment ID
 * @param {number} shipmentId - Shiprocket shipment ID
 * @returns {Promise<Object>} Shipment details including courier assignment status
 */
export async function getShipmentDetails(shipmentId) {
  const token = await authenticate()
  
  const response = await fetch(`${SHIPROCKET_API_BASE}/shipments/${shipmentId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error('Failed to fetch shipment details')
  }

  const result = await response.json()
  const shipmentData = result.data || result

  return {
    shipmentId: shipmentData.id,
    awbCode: shipmentData.awb_code,
    courierName: shipmentData.courier_name,
    courierAssigned: !!shipmentData.courier_name,
    status: shipmentData.status,
    orderId: shipmentData.order_id
  }
}

/**
 * Generate shipping label for a shipment
 * This only works AFTER courier is manually assigned in Shiprocket dashboard
 * @param {number} shipmentId - Shiprocket shipment ID
 * @returns {Promise<Object>} Label URL and generation status
 */
export async function generateShippingLabel(shipmentId) {
  const token = await authenticate()
  
  // First check if courier is assigned
  const shipmentDetails = await getShipmentDetails(shipmentId)
  
  if (!shipmentDetails.courierAssigned) {
    throw new Error('Courier not assigned. Please assign a courier service in Shiprocket dashboard first.')
  }

  // Generate the shipping label (PDF with QR code)
  const response = await fetch(`${SHIPROCKET_API_BASE}/courier/generate/label`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      shipment_id: [shipmentId]
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || 'Failed to generate shipping label')
  }

  const result = await response.json()

  return {
    labelUrl: result.label_url, // PDF URL with QR code
    isLabelGenerated: result.is_label_generated || true,
    notGeneratedIds: result.not_generated_ids || [],
    shipmentId: shipmentId,
    awbCode: shipmentDetails.awbCode,
    courierName: shipmentDetails.courierName
  }
}

/**
 * Map Shiprocket status to internal order status
 * @param {string} shiprocketStatus - Shiprocket shipment status
 * @returns {Object} { status: string, isRTO: boolean, requiresRefund: boolean }
 */
export function mapShiprocketStatus(shiprocketStatus) {
  const statusMap = {
    // Successful delivery
    'Delivered': { status: 'delivered', isRTO: false, requiresRefund: false },
    'DELIVERED': { status: 'delivered', isRTO: false, requiresRefund: false },
    
    // In Transit
    'Shipped': { status: 'dispatched', isRTO: false, requiresRefund: false },
    'IN TRANSIT': { status: 'dispatched', isRTO: false, requiresRefund: false },
    'Out for Delivery': { status: 'dispatched', isRTO: false, requiresRefund: false },
    
    // RTO (Return to Origin) - customer refused/not available
    'RTO': { status: 'cancelled', isRTO: true, requiresRefund: true },
    'RTO Initiated': { status: 'cancelled', isRTO: true, requiresRefund: true },
    'RTO IN TRANSIT': { status: 'cancelled', isRTO: true, requiresRefund: true },
    'RTO Delivered': { status: 'cancelled', isRTO: true, requiresRefund: true },
    'RTO_DELIVERED': { status: 'cancelled', isRTO: true, requiresRefund: true },
    
    // Lost/Damaged by courier
    'Lost': { status: 'cancelled', isRTO: false, requiresRefund: true },
    'LOST': { status: 'cancelled', isRTO: false, requiresRefund: true },
    'Damaged': { status: 'cancelled', isRTO: false, requiresRefund: true },
    
    // Cancelled orders
    'Cancelled': { status: 'cancelled', isRTO: false, requiresRefund: true },
    'CANCELLED': { status: 'cancelled', isRTO: false, requiresRefund: true },
    'Undelivered': { status: 'cancelled', isRTO: false, requiresRefund: true },
    'NOT SERVICEABLE': { status: 'cancelled', isRTO: false, requiresRefund: true }
  }

  return statusMap[shiprocketStatus] || { status: null, isRTO: false, requiresRefund: false }
}
