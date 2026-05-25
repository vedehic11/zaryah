import { createClient } from '@supabase/supabase-js'

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
    const addressIndex = order.address.indexOf(',')
    const cityIndex = order.address.lastIndexOf(city)
    const streetAddress = addressIndex >= 0 && cityIndex > addressIndex
      ? order.address.substring(addressIndex + 1, cityIndex).trim().replace(/,$/, '')
      : addressParts.slice(1, -2).join(', ')

    return { name, address: streetAddress, city, state, pincode, phone, email: buyer?.email || '' }
  }
  if (typeof order.address === 'object' && order.address !== null) {
    return {
      name: order.address.name || order.address.fullName || 'Customer',
      address: order.address.address || order.address.streetAddress || '',
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

function buildSellerPickupLocation(seller, orderId) {
  const pickupLocationName = seller?.business_name ? `${seller.business_name.substring(0, 20)}_${orderId.substring(0, 8)}` : `Seller_${orderId.substring(0, 8)}`
  return {
    name: pickupLocationName,
    contactName: seller?.full_name || seller?.business_name || 'Seller',
    phone: seller?.primary_mobile || '',
    address: seller?.business_address || '',
    city: seller?.city || '',
    state: seller?.state || '',
    pincode: seller?.pincode || '',
    email: seller?.email || ''
  }
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
    const pickupLocation = buildSellerPickupLocation(seller, ORDER_ID)
    pickupLocation.phone = normalizePhone(pickupLocation.phone)

    const items = (order.order_items || []).map(it => ({
      id: it.product_id,
      name: it.products?.name || 'Product',
      quantity: it.quantity,
      price: it.price,
      weight: it.products?.weight || 500
    }))

    const totalWeight = items.reduce((sum, item) => {
      const weightInKg = toKg(item.weight)
      return sum + (weightInKg * item.quantity)
    }, 0)

    const payload = {
      order_id: ORDER_ID,
      order_date: new Date(order.created_at).toISOString().split('T')[0],
      pickup_location: pickupLocation.name || 'Primary',
      billing_customer_name: deliveryAddress.name,
      billing_address: deliveryAddress.address,
      billing_city: deliveryAddress.city,
      billing_pincode: deliveryAddress.pincode,
      billing_state: deliveryAddress.state,
      billing_country: 'India',
      billing_email: deliveryAddress.email || 'customer@zaryah.com',
      billing_phone: deliveryAddress.phone,
      shipping_is_billing: true,
      shipping_customer_name: deliveryAddress.name,
      shipping_address: deliveryAddress.address,
      shipping_city: deliveryAddress.city,
      shipping_pincode: deliveryAddress.pincode,
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
      payment_method: (order.payment_method || 'online') === 'cod' ? 'COD' : 'Prepaid',
      sub_total: order.total_amount || 0,
      length: 10,
      breadth: 10,
      height: 10,
      weight: totalWeight
    }

    console.log('Pickup location:', pickupLocation)
    console.log('Delivery address:', deliveryAddress)
    console.log('Items:', items)
    console.log('Total weight (kg):', totalWeight.toFixed(3))
    console.log('Shiprocket payload preview:', payload)
  } catch (err) {
    console.error('Failed to build Shiprocket payload:', err.message || err)
    process.exit(3)
  }
}

main()
