import { createClient } from '@supabase/supabase-js'
const SHIPROCKET_API_BASE = 'https://apiv2.shiprocket.in/v1/external'

const ORDER_ID = process.env.ORDER_ID || '84b89675-4ecc-49e5-bd48-24015b57e4ad'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SHIPROCKET_EMAIL = process.env.SHIPROCKET_EMAIL
const SHIPROCKET_PASSWORD = process.env.SHIPROCKET_PASSWORD

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE URL or service role key not set. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.')
  process.exit(1)
}

if (!SHIPROCKET_EMAIL || !SHIPROCKET_PASSWORD) {
  console.error('Shiprocket credentials missing. Set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD in env.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function fetchOrder(id) {
  const { data: order, error } = await supabase
    .from('orders')
    .select(`*, order_items(*, products(*)), sellers!seller_id(*), buyers!buyer_id(*)`)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return order
}

function parseDeliveryAddress(order, buyer) {
  if (typeof order.address === 'string') {
    const phoneMatch = order.address.match(/Phone:\s*(\d+)/)
    const phone = phoneMatch ? phoneMatch[1] : buyer?.phone || ''
    const stateAndPincodeMatch = order.address.match(/([A-Za-z\s]+)\s*-\s*(\d{6})/)
    const state = stateAndPincodeMatch ? stateAndPincodeMatch[1].trim() : ''
    const pincode = stateAndPincodeMatch ? stateAndPincodeMatch[2] : ''
    const addressParts = order.address.split(',').map(s => s.trim())
    const city = addressParts[addressParts.length - 3] || ''
    const name = addressParts[0] || 'Customer'

    return { name, city, state, pincode, phone, email: buyer?.email || '' }
  }
  if (typeof order.address === 'object' && order.address !== null) {
    return {
      name: order.address.name || order.address.fullName || 'Customer',
      city: order.address.city || '',
      state: order.address.state || '',
      pincode: order.address.pincode || order.address.zipCode || '',
      phone: order.address.phone || order.address.mobile || buyer?.phone || '',
      email: order.address.email || buyer?.email || ''
    }
  }
  throw new Error('Invalid address format')
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  return digits
}

function toKg(grams) {
  const weight = Number(grams || 0)
  return weight > 0 ? weight / 1000 : 0.7
}

async function authenticateShiprocket() {
  const response = await fetch(`${SHIPROCKET_API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: SHIPROCKET_EMAIL,
      password: SHIPROCKET_PASSWORD
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(`Shiprocket auth failed: ${error.message || response.statusText}`)
  }

  const data = await response.json()
  if (!data.token) {
    throw new Error('Shiprocket auth failed: token missing')
  }

  return data.token
}

async function fetchServiceabilityRates({ pickupPincode, deliveryPincode, weight, codAmount }) {
  const token = await authenticateShiprocket()
  const params = new URLSearchParams({
    pickup_postcode: pickupPincode,
    delivery_postcode: deliveryPincode,
    weight: weight.toString(),
    length: '10',
    breadth: '10',
    height: '10',
    cod: codAmount > 0 ? '1' : '0'
  })

  if (codAmount > 0) {
    params.append('declared_value', codAmount.toString())
  }

  const response = await fetch(`${SHIPROCKET_API_BASE}/courier/serviceability/?${params.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(`Shiprocket serviceability failed: ${error.message || response.statusText}`)
  }

  const result = await response.json()
  const couriers = result?.data?.available_courier_companies || []

  return couriers
    .filter(courier => courier.freight_charge !== null)
    .map(courier => ({
      courier_name: courier.courier_name,
      courier_company_id: courier.courier_company_id,
      freight_charge: Number(courier.freight_charge),
      cod_charge: Number(courier.cod_charges || 0),
      total_charge: Number(courier.rate || courier.freight_charge),
      estimated_delivery_days: courier.estimated_delivery_days || courier.etd || 'N/A',
      is_surface: courier.is_surface || false,
      min_weight: courier.min_weight || 0,
      rating: courier.rating || 0
    }))
    .sort((a, b) => a.total_charge - b.total_charge)
}

async function main() {
  try {
    console.log('Fetching order', ORDER_ID)
    const order = await fetchOrder(ORDER_ID)
    if (!order) {
      console.error('Order not found')
      process.exit(2)
    }

    const buyer = order.buyers || {}
    const seller = order.sellers || {}

    const deliveryAddress = parseDeliveryAddress(order, buyer)
    deliveryAddress.phone = normalizePhone(deliveryAddress.phone)

    const pickupPincode = String(seller?.pincode || '').trim()
    const deliveryPincode = String(deliveryAddress.pincode || '').trim()

    if (!/^[0-9]{6}$/.test(pickupPincode)) {
      throw new Error('Invalid seller pickup pincode: ' + pickupPincode)
    }
    if (!/^[0-9]{6}$/.test(deliveryPincode)) {
      throw new Error('Invalid buyer delivery pincode: ' + deliveryPincode)
    }

    const totalWeightKg = (order.order_items || []).reduce((sum, item) => {
      const itemWeightKg = toKg(item.products?.weight || 700)
      return sum + (itemWeightKg * (item.quantity || 1))
    }, 0)

    const codAmount = (order.payment_method || '').toLowerCase() === 'cod'
      ? Number(order.total_amount || 0)
      : 0

    console.log('Route:', pickupPincode, '->', deliveryPincode)
    console.log('Total weight (kg):', totalWeightKg.toFixed(3))
    console.log('COD amount:', codAmount)

    const couriers = await fetchServiceabilityRates({
      pickupPincode,
      deliveryPincode,
      weight: totalWeightKg || 0.7,
      codAmount
    })

    if (!couriers.length) {
      console.log('No courier options returned')
      process.exit(0)
    }

    const cheapest = couriers[0]
    console.log('Cheapest Shiprocket rate:')
    console.log(cheapest)

    console.log('Top 5 options:')
    console.log(couriers.slice(0, 5))
  } catch (err) {
    console.error('Failed to calculate Shiprocket fee:', err.message || err)
    process.exit(3)
  }
}

main()
