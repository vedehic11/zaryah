import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const envResult = dotenv.config({ path: '.env.local' })
if (envResult.error) {
  dotenv.config()
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const shiprocketEmail = process.env.SHIPROCKET_EMAIL
const shiprocketPassword = process.env.SHIPROCKET_PASSWORD

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

if (!shiprocketEmail || !shiprocketPassword) {
  throw new Error('Missing Shiprocket environment variables')
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const SHIPROCKET_API_BASE = 'https://apiv2.shiprocket.in/v1/external'

function mapShiprocketStatus(shiprocketStatus) {
  if (!shiprocketStatus) return { status: null, isRTO: false, requiresRefund: false }

  if (typeof shiprocketStatus === 'number' || /^\d+$/.test(String(shiprocketStatus))) {
    const statusCode = Number(shiprocketStatus)
    const statusCodeMap = {
      1: { status: 'confirmed', isRTO: false, requiresRefund: false },
      2: { status: 'confirmed', isRTO: false, requiresRefund: false },
      3: { status: 'dispatched', isRTO: false, requiresRefund: false },
      4: { status: 'dispatched', isRTO: false, requiresRefund: false },
      5: { status: 'dispatched', isRTO: false, requiresRefund: false },
      6: { status: 'dispatched', isRTO: false, requiresRefund: false },
      7: { status: 'delivered', isRTO: false, requiresRefund: false },
      8: { status: 'cancelled', isRTO: false, requiresRefund: true },
      9: { status: 'cancelled', isRTO: true, requiresRefund: true },
      10: { status: 'cancelled', isRTO: true, requiresRefund: true },
      11: { status: 'cancelled', isRTO: true, requiresRefund: true },
      12: { status: 'cancelled', isRTO: false, requiresRefund: true },
      13: { status: 'cancelled', isRTO: false, requiresRefund: true },
      14: { status: 'cancelled', isRTO: false, requiresRefund: true }
    }
    return statusCodeMap[statusCode] || { status: null, isRTO: false, requiresRefund: false }
  }

  const normalizedStatus = String(shiprocketStatus)
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase()

  const statusMap = {
    'DELIVERED': { status: 'delivered', isRTO: false, requiresRefund: false },
    'PENDING PICKUP': { status: 'confirmed', isRTO: false, requiresRefund: false },
    'PICKUP SCHEDULED': { status: 'confirmed', isRTO: false, requiresRefund: false },
    'OUT FOR PICKUP': { status: 'confirmed', isRTO: false, requiresRefund: false },
    'PICKUP COMPLETE': { status: 'dispatched', isRTO: false, requiresRefund: false },
    'PICKUP EXCEPTION': { status: 'confirmed', isRTO: false, requiresRefund: false },
    'SHIPPED': { status: 'dispatched', isRTO: false, requiresRefund: false },
    'IN TRANSIT': { status: 'dispatched', isRTO: false, requiresRefund: false },
    'OUT FOR DELIVERY': { status: 'dispatched', isRTO: false, requiresRefund: false },
    'SHIPMENT DELAYED': { status: 'dispatched', isRTO: false, requiresRefund: false },
    'ATTEMPTED DELIVERY': { status: 'dispatched', isRTO: false, requiresRefund: false },
    'CUSTOMER UNAVAILABLE': { status: 'dispatched', isRTO: false, requiresRefund: false },
    'RTO': { status: 'cancelled', isRTO: true, requiresRefund: true },
    'RTO INITIATED': { status: 'cancelled', isRTO: true, requiresRefund: true },
    'RTO IN TRANSIT': { status: 'cancelled', isRTO: true, requiresRefund: true },
    'RTO DELIVERED': { status: 'cancelled', isRTO: true, requiresRefund: true },
    'LOST': { status: 'cancelled', isRTO: false, requiresRefund: true },
    'DAMAGED': { status: 'cancelled', isRTO: false, requiresRefund: true },
    'CANCELLED': { status: 'cancelled', isRTO: false, requiresRefund: true },
    'UNDELIVERED': { status: 'cancelled', isRTO: false, requiresRefund: true },
    'NOT SERVICEABLE': { status: 'cancelled', isRTO: false, requiresRefund: true }
  }

  if (statusMap[normalizedStatus]) return statusMap[normalizedStatus]
  if (normalizedStatus.includes('RTO')) return { status: 'cancelled', isRTO: true, requiresRefund: true }
  if (normalizedStatus.includes('DELIVER') && !normalizedStatus.includes('UNDELIVER')) return { status: 'delivered', isRTO: false, requiresRefund: false }
  if (
    normalizedStatus.includes('IN TRANSIT') ||
    normalizedStatus.includes('SHIPPED') ||
    normalizedStatus.includes('OUT FOR DELIVERY') ||
    normalizedStatus.includes('PICKUP COMPLETE') ||
    normalizedStatus.includes('MANIFEST') ||
    normalizedStatus.includes('REACHED HUB')
  ) return { status: 'dispatched', isRTO: false, requiresRefund: false }
  if (
    normalizedStatus.includes('PICKUP') ||
    normalizedStatus.includes('NEW') ||
    normalizedStatus.includes('BOOKED') ||
    normalizedStatus.includes('AWB')
  ) return { status: 'confirmed', isRTO: false, requiresRefund: false }
  if (
    normalizedStatus.includes('LOST') ||
    normalizedStatus.includes('DAMAGED') ||
    normalizedStatus.includes('CANCEL') ||
    normalizedStatus.includes('UNDELIVER') ||
    normalizedStatus.includes('FAILED')
  ) return { status: 'cancelled', isRTO: false, requiresRefund: true }

  return { status: null, isRTO: false, requiresRefund: false }
}

async function authenticateShiprocket() {
  const response = await fetch(`${SHIPROCKET_API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: shiprocketEmail, password: shiprocketPassword })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Shiprocket authentication failed: ${error}`)
  }

  const data = await response.json()
  return data.token
}

async function getTracking(token, awbCode) {
  const response = await fetch(`${SHIPROCKET_API_BASE}/courier/track/awb/${awbCode}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Tracking fetch failed for AWB ${awbCode}: ${error}`)
  }

  return response.json()
}

async function getShipment(token, shipmentId) {
  const response = await fetch(`${SHIPROCKET_API_BASE}/shipments/${shipmentId}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Shipment fetch failed for shipment ${shipmentId}: ${error}`)
  }

  return response.json()
}

const { data: orders, error } = await supabase
  .from('orders')
  .select('id, status, payment_status, shipment_status, awb_code, shipment_id, courier_name, created_at')
  .or('awb_code.not.is.null,shipment_id.not.is.null')
  .order('created_at', { ascending: false })
  .limit(15)

if (error) {
  throw new Error(`Failed to fetch orders from Supabase: ${error.message}`)
}

if (!orders?.length) {
  console.log('No orders with Shiprocket references found.')
  process.exit(0)
}

const token = await authenticateShiprocket()
const results = []

for (const order of orders) {
  try {
    let liveStatus = null
    let source = null
    let awbCode = order.awb_code || null
    let courierName = order.courier_name || null

    if (order.awb_code) {
      const trackingData = await getTracking(token, order.awb_code)
      const tracking = trackingData?.tracking_data || trackingData || {}
      liveStatus = tracking.shipment_status || tracking.current_status || tracking.status || null
      source = 'awb'
    }

    if ((!liveStatus || !awbCode) && order.shipment_id) {
      const shipmentData = await getShipment(token, order.shipment_id)
      const shipment = shipmentData?.data?.shipment_data || shipmentData?.data || shipmentData || {}
      liveStatus = liveStatus || shipment.status || shipment.current_status || null
      awbCode = awbCode || shipment.awb || shipment.awb_code || shipment.awbCode || null
      courierName = courierName || shipment.courier_name || shipment.courierName || null
      source = source || 'shipment'
    }

    const mapped = mapShiprocketStatus(liveStatus)
    results.push({
      id: order.id,
      dbStatus: order.status,
      paymentStatus: order.payment_status,
      dbShipmentStatus: order.shipment_status,
      liveStatus,
      mappedStatus: mapped.status,
      isRTO: mapped.isRTO,
      awbCode,
      shipmentId: order.shipment_id,
      courierName,
      source
    })
  } catch (fetchError) {
    results.push({
      id: order.id,
      dbStatus: order.status,
      paymentStatus: order.payment_status,
      dbShipmentStatus: order.shipment_status,
      shipmentId: order.shipment_id,
      awbCode: order.awb_code,
      error: fetchError.message
    })
  }
}

console.log(JSON.stringify(results, null, 2))
