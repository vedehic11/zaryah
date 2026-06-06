import { supabase } from '@/lib/supabase'
import { sendSellerOrderPlacedEmail } from '@/lib/email'

const EMAIL_SENT_MARKER = '[seller_email_sent]'

function hasEmailSentMarker(notes) {
  return String(notes || '').includes(EMAIL_SENT_MARKER)
}

async function fetchSellerEmailAndName(sellerId) {
  const [{ data: sellerProfile }, { data: sellerUser }] = await Promise.all([
    supabase
      .from('sellers')
      .select('id, business_name, username, full_name')
      .eq('id', sellerId)
      .maybeSingle(),
    supabase
      .from('users')
      .select('id, email, name')
      .eq('id', sellerId)
      .maybeSingle()
  ])

  return {
    sellerEmail: sellerUser?.email || null,
    sellerName: sellerProfile?.business_name || sellerProfile?.full_name || sellerUser?.name || 'Seller'
  }
}

async function fetchBuyerName(buyerId) {
  if (!buyerId) {
    return null
  }

  const { data: buyerUser } = await supabase
    .from('users')
    .select('id, name')
    .eq('id', buyerId)
    .maybeSingle()

  return buyerUser?.name || null
}

async function appendEmailSentMarker(orderId, notes) {
  const currentNotes = String(notes || '')
  if (currentNotes.includes(EMAIL_SENT_MARKER)) {
    return currentNotes
  }

  const timestamp = new Date().toISOString()
  const markerLine = `${EMAIL_SENT_MARKER} ${timestamp}`
  const nextNotes = currentNotes ? `${currentNotes}\n${markerLine}` : markerLine

  await supabase
    .from('orders')
    .update({ notes: nextNotes })
    .eq('id', orderId)

  return nextNotes
}

export async function sendSellerOrderNotificationIfNeeded({
  order,
  buyerName,
  totalAmount,
  items = []
}) {
  if (!order?.id) {
    return { sent: false, skipped: true, reason: 'missing-order' }
  }

  if (hasEmailSentMarker(order.notes)) {
    return { sent: false, skipped: true, reason: 'already-sent' }
  }

  if (!order.seller_id) {
    return { sent: false, skipped: true, reason: 'missing-seller' }
  }

  const { sellerEmail, sellerName } = await fetchSellerEmailAndName(order.seller_id)

  if (!sellerEmail) {
    return { sent: false, skipped: true, reason: 'missing-seller-email' }
  }

  const resolvedBuyerName = buyerName || (await fetchBuyerName(order.buyer_id)) || 'Buyer'

  await sendSellerOrderPlacedEmail({
    to: sellerEmail,
    sellerName,
    orderId: order.id,
    buyerName: resolvedBuyerName,
    totalAmount,
    items
  })

  await appendEmailSentMarker(order.id, order.notes)

  return {
    sent: true,
    to: sellerEmail,
    sellerName
  }
}
