import { createClient } from '@supabase/supabase-js'
import { calculateShippingRates } from '../lib/shiprocket.js'

const ORDER_ID = process.env.ORDER_ID || '84b89675-4ecc-49e5-bd48-24015b57e4ad'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE URL or service role key not set. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.')
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
  return weight > 0 ? weight / 1000 : 0.5
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
      const itemWeightKg = toKg(item.products?.weight || 500)
      return sum + (itemWeightKg * (item.quantity || 1))
    }, 0)

    const codAmount = (order.payment_method || '').toLowerCase() === 'cod'
      ? Number(order.total_amount || 0)
      : 0

    console.log('Route:', pickupPincode, '->', deliveryPincode)
    console.log('Total weight (kg):', totalWeightKg.toFixed(3))
    console.log('COD amount:', codAmount)

    const couriers = await calculateShippingRates({
      pickupPincode,
      deliveryPincode,
      weight: totalWeightKg || 0.5,
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
