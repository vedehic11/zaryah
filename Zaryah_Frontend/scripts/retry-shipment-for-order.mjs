import { createClient } from '@supabase/supabase-js'
import { createShipment } from '../lib/shiprocket.js'
import * as path from 'path'

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
  const pickupLocationName = seller?.business_name ? `${seller.business_name.substring(0,20)}_${orderId.substring(0,8)}` : `Seller_${orderId.substring(0,8)}`
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
    const pickupLocation = buildSellerPickupLocation(seller, ORDER_ID)

    deliveryAddress.phone = normalizePhone(deliveryAddress.phone)
    pickupLocation.phone = normalizePhone(pickupLocation.phone)

    console.log('Delivery address:', deliveryAddress)
    console.log('Pickup location:', pickupLocation)

    // validate phone/pincode
    if (!/^[0-9]{10}$/.test(String(deliveryAddress.phone || ''))) {
      throw new Error('Invalid buyer phone: ' + (deliveryAddress.phone || ''))
    }
    if (!/^[0-9]{10}$/.test(String(pickupLocation.phone || ''))) {
      console.warn('Seller phone invalid or missing:', pickupLocation.phone)
    }
    if (!/^[0-9]{6}$/.test(String(deliveryAddress.pincode || ''))) {
      throw new Error('Invalid buyer pincode: ' + (deliveryAddress.pincode || ''))
    }

    const items = (order.order_items || []).map(it => ({ id: it.product_id, name: it.products?.name || 'Product', quantity: it.quantity, price: it.price, weight: it.products?.weight || 500 }))

    console.log('Creating shipment via Shiprocket API...')

    const shipment = await createShipment({ orderId: ORDER_ID, orderDate: new Date(order.created_at).toISOString().split('T')[0], pickupLocation, deliveryAddress, items, totalAmount: order.total_amount || 0, paymentMethod: order.payment_method || 'online', autoAssignAwb: true })

    console.log('Shipment result:', shipment)

    // Update order in supabase
    const update = {
      shipment_id: shipment.shipment_id,
      awb_code: shipment.awb_code,
      courier_name: shipment.courier_name,
      tracking_url: shipment.tracking_url,
      shipment_status: shipment.status,
      shipment_created_at: new Date().toISOString()
    }

    if (shipment.awb_code) update.status = 'dispatched'

    const { data: updated, error } = await supabase.from('orders').update(update).eq('id', ORDER_ID).select().single()
    if (error) throw error

    console.log('Order updated:', updated.id)
    process.exit(0)
  } catch (err) {
    console.error('Failed to retry shipment:', err.message || err)
    process.exit(3)
  }
}

main()
