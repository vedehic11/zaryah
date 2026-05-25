import { createClient } from '@supabase/supabase-js'

const ORDER_ID = process.env.ORDER_ID || '84b89675-4ecc-49e5-bd48-24015b57e4ad'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE URL or service role key not set. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, total_amount, delivery_fee, platform_fee, gift_packaging_fee, payment_method, payment_status, order_items(price, quantity), created_at')
      .eq('id', ORDER_ID)
      .maybeSingle()

    if (error) throw error
    if (!order) {
      console.error('Order not found')
      process.exit(2)
    }

    const productSubtotal = (order.order_items || []).reduce((sum, item) => {
      return sum + (Number(item.price || 0) * Number(item.quantity || 0))
    }, 0)

    const deliveryFee = Number(order.delivery_fee || 0)
    const platformFee = Number(order.platform_fee || 0)
    const giftFee = Number(order.gift_packaging_fee || 0)

    const computedTotal = productSubtotal + deliveryFee + platformFee + giftFee

    console.log('Order:', order.id)
    console.log('Created at:', order.created_at)
    console.log('Payment:', order.payment_method, order.payment_status)
    console.log('Product subtotal:', productSubtotal)
    console.log('Delivery fee:', deliveryFee)
    console.log('Platform fee:', platformFee)
    console.log('Gift fee:', giftFee)
    console.log('Computed total:', computedTotal)
    console.log('Stored total_amount:', Number(order.total_amount || 0))
    console.log('Delta (stored - computed):', Number(order.total_amount || 0) - computedTotal)
  } catch (err) {
    console.error('Failed to load order:', err.message || err)
    process.exit(3)
  }
}

main()
