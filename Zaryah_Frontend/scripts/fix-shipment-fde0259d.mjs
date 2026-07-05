/**
 * One-off script to create shipment for order fde0259d-2480-4109-829f-c159738f8d76
 * which got stuck at 'ready' without a Shiprocket shipment.
 */
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import crypto from 'crypto'

dotenv.config({ path: '.env.local' })

const ORDER_ID = 'fde0259d-2480-4109-829f-c159738f8d76'
const SHIPROCKET_API_BASE = 'https://apiv2.shiprocket.in/v1/external'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function authenticateShiprocket() {
  const response = await fetch(`${SHIPROCKET_API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD
    })
  })
  if (!response.ok) throw new Error(`Auth failed: ${await response.text()}`)
  const data = await response.json()
  return data.token
}

function parseDeliveryAddress(addressStr) {
  const phoneMatch = addressStr.match(/Phone:\s*(\d+)/)
  const phone = phoneMatch ? phoneMatch[1] : ''
  const statePin = addressStr.match(/([A-Za-z\s]+)\s*-\s*(\d{6})/)
  const state = statePin ? statePin[1].trim() : ''
  const pincode = statePin ? statePin[2] : ''
  const parts = addressStr.split(',').map(s => s.trim())
  const name = parts[0] || 'Customer'

  // For 4-part address: "Name, Street, City, State - Pincode. Phone: XXXX"
  // City is at index length-2
  const city = parts.length >= 3 ? parts[parts.length - 2]?.replace(/\s*-.*$/, '').trim() : ''

  // Street is everything between name and city
  const streetParts = parts.slice(1, parts.length - 2)
  const street = streetParts.join(', ').trim()

  return { name, address: street || parts[1] || '', city, state, pincode, phone, email: 'customer@zaryah.com' }
}

async function main() {
  console.log('🔍 Fetching order:', ORDER_ID)

  const { data: order, error } = await supabase
    .from('orders')
    .select('*, order_items(*, products(*)), sellers!seller_id(*), buyers!buyer_id(*)')
    .eq('id', ORDER_ID)
    .single()

  if (error) { console.error('DB error:', error); process.exit(1) }

  console.log('📋 Order status:', order.status, '| payment:', order.payment_status, '| shipment_id:', order.shipment_id)

  if (order.shipment_id) {
    console.log('✅ Shipment already exists:', order.shipment_id)
    process.exit(0)
  }

  const seller = order.sellers
  const deliveryAddress = parseDeliveryAddress(order.address)

  console.log('📦 Delivery:', JSON.stringify(deliveryAddress, null, 2))

  // Validate
  if (!/^\d{10}$/.test(deliveryAddress.phone)) throw new Error('Invalid phone: ' + deliveryAddress.phone)
  if (!/^\d{6}$/.test(deliveryAddress.pincode)) throw new Error('Invalid pincode: ' + deliveryAddress.pincode)

  const pickupLocationName = `${(seller.business_name || 'Seller').substring(0, 20)}_${ORDER_ID.substring(0, 8)}`
  const pickupLocation = {
    name: pickupLocationName,
    contactName: seller.full_name || seller.business_name || 'Seller',
    phone: seller.primary_mobile || '',
    address: (seller.business_address || '').trim(),
    city: seller.city || '',
    state: (seller.state || '').trim(),
    pincode: seller.pincode || '',
    email: seller.email || 'seller@zaryah.com'
  }

  console.log('🏪 Pickup:', JSON.stringify(pickupLocation, null, 2))

  const items = (order.order_items || []).map(it => ({
    id: it.product_id,
    name: it.products?.name || 'Product',
    quantity: it.quantity,
    price: it.price,
    weight: it.products?.weight || 700
  }))

  const totalWeight = items.reduce((sum, item) => {
    return sum + ((item.weight || 700) / 1000) * item.quantity
  }, 0)

  const orderDate = new Date(order.created_at).toISOString().split('T')[0]

  console.log('📅 Order date:', orderDate, '| Items:', items.length, '| Weight:', totalWeight, 'kg')

  // Authenticate with Shiprocket
  const token = await authenticateShiprocket()
  console.log('✅ Shiprocket authenticated')

  // Ensure pickup location
  const addPickupRes = await fetch(`${SHIPROCKET_API_BASE}/settings/company/addpickup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      pickup_location: pickupLocation.name,
      name: pickupLocation.contactName,
      email: pickupLocation.email,
      phone: pickupLocation.phone,
      address: pickupLocation.address,
      address_2: '',
      city: pickupLocation.city,
      state: pickupLocation.state,
      country: 'India',
      pin_code: pickupLocation.pincode
    })
  })
  console.log('📍 Pickup location result:', addPickupRes.status, addPickupRes.statusText)

  // Create order on Shiprocket
  const shipmentData = {
    order_id: ORDER_ID,
    order_date: orderDate,
    pickup_location: pickupLocation.name,
    channel_id: '',
    comment: 'Order from Zaryah',
    billing_customer_name: deliveryAddress.name,
    billing_last_name: '',
    billing_address: deliveryAddress.address,
    billing_address_2: '',
    billing_city: deliveryAddress.city,
    billing_pincode: deliveryAddress.pincode,
    billing_state: deliveryAddress.state,
    billing_country: 'India',
    billing_email: deliveryAddress.email,
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
    shipping_email: deliveryAddress.email,
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
    payment_method: order.payment_method === 'cod' ? 'COD' : 'Prepaid',
    shipping_charges: 0,
    giftwrap_charges: 0,
    transaction_charges: 0,
    total_discount: 0,
    sub_total: order.total_amount,
    length: 10,
    breadth: 10,
    height: 10,
    weight: totalWeight
  }

  console.log('🚀 Creating Shiprocket order...')
  const createRes = await fetch(`${SHIPROCKET_API_BASE}/orders/create/adhoc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(shipmentData)
  })

  if (!createRes.ok) {
    const errBody = await createRes.json().catch(() => ({}))
    console.error('❌ Shiprocket create failed:', createRes.status, JSON.stringify(errBody, null, 2))
    process.exit(1)
  }

  const result = await createRes.json()
  console.log('✅ Shiprocket order created:', JSON.stringify({ order_id: result.order_id, shipment_id: result.shipment_id }, null, 2))

  if (!result.shipment_id) {
    console.error('❌ No shipment_id in response:', JSON.stringify(result, null, 2))
    process.exit(1)
  }

  // Assign AWB
  let awbCode = null
  let courierName = 'Pending Assignment'

  try {
    console.log('🔄 Assigning AWB...')
    const awbRes = await fetch(`${SHIPROCKET_API_BASE}/courier/assign/awb`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ shipment_id: result.shipment_id })
    })

    if (awbRes.ok) {
      const awbResult = await awbRes.json()
      awbCode = awbResult.response?.data?.awb_code || awbResult.awb_code
      courierName = awbResult.response?.data?.courier_name || awbResult.courier_name || courierName
      console.log('✅ AWB assigned:', awbCode, '| Courier:', courierName)

      // Generate pickup
      try {
        await fetch(`${SHIPROCKET_API_BASE}/courier/generate/pickup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ shipment_id: [result.shipment_id] })
        })
        console.log('✅ Pickup request generated')
      } catch (e) { console.warn('⚠️ Pickup generation failed (non-critical):', e.message) }
    } else {
      const awbErr = await awbRes.json().catch(() => ({}))
      console.warn('⚠️ AWB assignment failed:', JSON.stringify(awbErr))
    }
  } catch (e) { console.warn('⚠️ AWB error:', e.message) }

  // Update order in DB
  const update = {
    shipment_id: result.shipment_id,
    awb_code: awbCode,
    courier_name: courierName,
    tracking_url: awbCode ? `https://shiprocket.co/tracking/${awbCode}` : null,
    shipment_status: result.status || 'PENDING',
    shipment_created_at: new Date().toISOString(),
    notes: null  // Clear any old error notes
  }

  if (awbCode) {
    update.status = 'dispatched'
  }

  const { data: updated, error: updateError } = await supabase
    .from('orders')
    .update(update)
    .eq('id', ORDER_ID)
    .select('id, status, shipment_id, awb_code, courier_name')
    .single()

  if (updateError) {
    console.error('❌ DB update failed:', updateError)
    process.exit(1)
  }

  console.log('\n✅ ORDER FIXED:', JSON.stringify(updated, null, 2))
  process.exit(0)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
