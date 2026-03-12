import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local' })

const orderId = process.argv[2]
if (!orderId) {
  throw new Error('Order id is required')
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const SHIPROCKET_API_BASE = 'https://apiv2.shiprocket.in/v1/external'

const { data: order, error } = await supabase
  .from('orders')
  .select('id,status,payment_status,shipment_status,awb_code,shipment_id,courier_name,tracking_url,created_at,updated_at,buyer_id,seller_id')
  .eq('id', orderId)
  .single()

if (error) {
  throw error
}

const authRes = await fetch(`${SHIPROCKET_API_BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: process.env.SHIPROCKET_EMAIL,
    password: process.env.SHIPROCKET_PASSWORD
  })
})

if (!authRes.ok) {
  throw new Error(`Shiprocket auth failed: ${await authRes.text()}`)
}

const authJson = await authRes.json()
const token = authJson.token
let shiprocket = null
let source = null

if (order.awb_code) {
  const response = await fetch(`${SHIPROCKET_API_BASE}/courier/track/awb/${order.awb_code}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  shiprocket = await response.json()
  source = 'awb'
} else if (order.shipment_id) {
  const response = await fetch(`${SHIPROCKET_API_BASE}/shipments/${order.shipment_id}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  shiprocket = await response.json()
  source = 'shipment'
}

console.log(JSON.stringify({ order, source, shiprocket }, null, 2))
