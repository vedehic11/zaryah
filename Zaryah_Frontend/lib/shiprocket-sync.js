import { supabase } from '@/lib/supabase'
import { getShipmentDetails, getShipmentTracking, mapShiprocketStatus } from '@/lib/shiprocket'

function normalizeStatusValue(value) {
  return value === null || value === undefined ? null : String(value)
}

function buildTrackingUrl(awbCode) {
  return awbCode ? `https://shiprocket.co/tracking/${awbCode}` : null
}

async function reverseAdminEarnings(orderId) {
  const { data: adminEarning } = await supabase
    .from('admin_earnings')
    .select('*')
    .eq('order_id', orderId)
    .eq('status', 'earned')
    .maybeSingle()

  if (!adminEarning) {
    return false
  }

  await supabase
    .from('admin_earnings')
    .update({
      status: 'reversed',
      reversed_at: new Date().toISOString()
    })
    .eq('id', adminEarning.id)

  return true
}

async function createNotification(payload) {
  const { error } = await supabase.from('notifications').insert(payload)
  if (error) {
    console.error('Notification insert failed:', error)
  }
}

async function processCancellation(order, currentStatus, isRTO, notes) {
  if (order.payment_status === 'paid' && order.payment_method === 'online' && order.razorpay_payment_id) {
    try {
      const { default: Razorpay } = await import('razorpay')
      const razorpay = new Razorpay({
        key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
      })

      const refundAmount = Math.round(parseFloat(order.total_amount || 0) * 100)
      const refund = await razorpay.payments.refund(order.razorpay_payment_id, {
        amount: refundAmount,
        notes: {
          reason: isRTO ? 'RTO - Return to Origin' : 'Shipment Failed',
          order_id: order.id,
          shipment_status: currentStatus
        }
      })

      await supabase
        .from('orders')
        .update({
          payment_status: 'refunded',
          notes: `${notes}\n💰 Refund initiated: ₹${(refundAmount / 100).toFixed(2)} (ID: ${refund.id})`
        })
        .eq('id', order.id)
    } catch (refundError) {
      console.error('Auto refund failed:', refundError)
      await supabase
        .from('orders')
        .update({
          notes: `${notes}\n⚠️ Auto-refund failed: ${refundError.message}. Admin needs to process manually.`
        })
        .eq('id', order.id)
    }
  }

  if (order.wallet_credited && parseFloat(order.seller_amount || 0) > 0) {
    const sellerAmount = parseFloat(order.seller_amount)
    const { data: reversalTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('order_id', order.id)
      .eq('type', 'reversal_rto')
      .limit(1)
      .maybeSingle()

    if (!reversalTx) {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('pending_balance, available_balance, total_earned')
        .eq('seller_id', order.seller_id)
        .single()

      if (wallet) {
        const currentPending = parseFloat(wallet.pending_balance || 0)
        const currentAvailable = parseFloat(wallet.available_balance || 0)
        const currentTotalEarned = parseFloat(wallet.total_earned || 0)

        await supabase
          .from('wallets')
          .update({
            available_balance: Math.max(0, currentAvailable - sellerAmount),
            pending_balance: currentPending,
            total_earned: Math.max(0, currentTotalEarned - sellerAmount),
            updated_at: new Date().toISOString()
          })
          .eq('seller_id', order.seller_id)
      }

      await supabase
        .from('transactions')
        .insert({
          seller_id: order.seller_id,
          order_id: order.id,
          amount: -sellerAmount,
          type: 'reversal_rto',
          status: 'completed',
          description: isRTO ? 'RTO - Funds reversed due to return to origin' : 'Cancelled - Funds reversed due to failed delivery'
        })

      await supabase
        .from('orders')
        .update({ wallet_credited: false })
        .eq('id', order.id)
    }
  }

  await reverseAdminEarnings(order.id)

  await Promise.all([
    createNotification({
      user_id: order.buyer_id,
      user_model: 'Buyer',
      title: isRTO ? 'Delivery Failed - Refund Initiated' : 'Order Cancelled - Refund Initiated',
      message: isRTO
        ? `Your order could not be delivered (${currentStatus}). ${order.payment_method === 'online' ? `Refund of ₹${order.total_amount} has been initiated to your payment method.` : 'No payment was collected as this was a COD order.'}`
        : `Your order was cancelled due to shipment failure (${currentStatus}). ${order.payment_method === 'online' ? `Refund of ₹${order.total_amount} has been initiated.` : ''}`,
      type: 'order',
      related_order_id: order.id,
      priority: 'high',
      action_url: '/orders'
    }),
    createNotification({
      user_id: order.seller_id,
      user_model: 'Seller',
      title: isRTO ? 'RTO - Package Returned' : 'Delivery Failed',
      message: isRTO
        ? `Order was returned to origin (${currentStatus}). The package will be returned to your pickup location. Buyer has been refunded.`
        : `Delivery failed for order (${currentStatus}). Buyer has been refunded. No earnings will be credited.`,
      type: 'order',
      related_order_id: order.id,
      priority: 'high',
      action_url: '/seller/dashboard?tab=orders'
    })
  ])
}

async function processDelivery(order) {
  if (order.payment_method === 'cod' && order.payment_status !== 'paid') {
    await supabase
      .from('orders')
      .update({ payment_status: 'paid' })
      .eq('id', order.id)

    order.payment_status = 'paid'
  }

  if (order.payment_status === 'paid' && order.seller_id && !order.wallet_credited) {
    const sellerEarnings = parseFloat(order.seller_amount || 0)

    if (sellerEarnings > 0) {
      const { error: walletError } = await supabase
        .rpc('move_pending_to_available', {
          p_seller_id: order.seller_id,
          p_order_id: order.id,
          p_amount: sellerEarnings
        })

      if (!walletError) {
        await supabase
          .from('orders')
          .update({ wallet_credited: true })
          .eq('id', order.id)

        const { data: existingAvailableTx } = await supabase
          .from('transactions')
          .select('id')
          .eq('order_id', order.id)
          .eq('type', 'credit_available')
          .limit(1)
          .maybeSingle()

        if (!existingAvailableTx) {
          await supabase
            .from('transactions')
            .insert({
              seller_id: order.seller_id,
              order_id: order.id,
              amount: sellerEarnings,
              type: 'credit_available',
              status: 'completed',
              description: 'Order delivered - Funds released to available balance'
            })
        }
      }
    }
  }

  await Promise.all([
    createNotification({
      user_id: order.buyer_id,
      user_model: 'Buyer',
      title: 'Order Delivered Successfully! 🎉',
      message: 'Your order has been delivered successfully. We hope you love it! Please leave a review to help other buyers.',
      type: 'delivery',
      related_order_id: order.id,
      priority: 'medium',
      action_url: '/orders'
    }),
    createNotification({
      user_id: order.seller_id,
      user_model: 'Seller',
      title: 'Order Delivered - Earnings Available',
      message: 'Your order has been successfully delivered! Earnings are now available in your wallet for withdrawal.',
      type: 'order',
      related_order_id: order.id,
      priority: 'medium',
      action_url: '/seller/dashboard?tab=wallet'
    })
  ])
}

export async function applyShiprocketOrderUpdate(order, liveUpdate, options = {}) {
  const previousStatus = order.status
  const currentStatus = normalizeStatusValue(liveUpdate.currentStatus)
  const statusMapping = mapShiprocketStatus(currentStatus)
  const nextStatus = statusMapping.status || order.status
  const awbCode = liveUpdate.awbCode || order.awb_code || null
  const courierName = liveUpdate.courierName || order.courier_name || null
  const trackingUrl = liveUpdate.trackingUrl || buildTrackingUrl(awbCode) || order.tracking_url || null
  const notes = nextStatus === 'cancelled'
    ? statusMapping.isRTO
      ? `⚠️ RTO (Return to Origin): Package could not be delivered and is being returned to seller. Reason: ${currentStatus}. Buyer will be refunded.`
      : `⚠️ Order ${currentStatus}: Shipment failed. Buyer will be refunded.`
    : order.notes

  const updates = {}

  if (currentStatus && currentStatus !== normalizeStatusValue(order.shipment_status)) {
    updates.shipment_status = currentStatus
  }

  if (nextStatus && nextStatus !== order.status) {
    updates.status = nextStatus
  }

  if (awbCode && awbCode !== order.awb_code) {
    updates.awb_code = awbCode
  }

  if (courierName && courierName !== order.courier_name) {
    updates.courier_name = courierName
  }

  if (trackingUrl && trackingUrl !== order.tracking_url) {
    updates.tracking_url = trackingUrl
  }

  if (liveUpdate.deliveredDate && nextStatus === 'delivered') {
    updates.updated_at = new Date(liveUpdate.deliveredDate).toISOString()
  }

  if (notes && notes !== order.notes) {
    updates.notes = notes
  }

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', order.id)

    if (updateError) {
      throw updateError
    }
  }

  if (nextStatus === 'cancelled' && previousStatus !== 'cancelled') {
    await processCancellation(order, currentStatus, statusMapping.isRTO, notes)
  }

  if (nextStatus === 'delivered' && previousStatus !== 'delivered') {
    await processDelivery(order)
  }

  if (nextStatus && nextStatus !== previousStatus && !['delivered', 'cancelled'].includes(nextStatus)) {
    await createNotification({
      user_id: order.buyer_id,
      user_model: 'Buyer',
      title: 'Order Status Updated',
      message: `Your order status has been updated to: ${currentStatus}. ${awbCode ? `Track your shipment: ${awbCode}` : ''}`,
      type: 'delivery',
      related_order_id: order.id,
      priority: 'low',
      action_url: trackingUrl || '/orders'
    })
  }

  return {
    orderId: order.id,
    previousStatus,
    status: nextStatus,
    shipmentStatus: currentStatus,
    awbCode,
    courierName,
    trackingUrl,
    isRTO: statusMapping.isRTO,
    requiresRefund: statusMapping.requiresRefund,
    source: options.source || 'sync'
  }
}

export async function fetchShiprocketLiveUpdate(order) {
  let currentStatus = null
  let awbCode = order.awb_code || null
  let courierName = order.courier_name || null
  let deliveredDate = null
  let source = null

  if (order.awb_code) {
    try {
      const trackingData = await getShipmentTracking(order.awb_code)
      const tracking = trackingData?.tracking_data || trackingData || {}
      currentStatus = tracking.shipment_status || tracking.current_status || tracking.status || currentStatus
      deliveredDate = tracking.delivered_date || tracking.delivery_date || null
      source = 'awb'
    } catch (error) {
      console.warn(`AWB sync failed for order ${order.id}:`, error.message)
    }
  }

  if ((!currentStatus || !awbCode || !courierName) && order.shipment_id) {
    const shipment = await getShipmentDetails(order.shipment_id)
    currentStatus = currentStatus || shipment?.status || null
    awbCode = awbCode || shipment?.awbCode || null
    courierName = courierName || shipment?.courierName || null
    source = source || 'shipment'
  }

  return {
    currentStatus,
    awbCode,
    courierName,
    trackingUrl: buildTrackingUrl(awbCode),
    deliveredDate,
    source
  }
}

export async function syncShiprocketOrder(order, options = {}) {
  const liveUpdate = await fetchShiprocketLiveUpdate(order)

  if (!liveUpdate.currentStatus && !liveUpdate.awbCode && !liveUpdate.courierName) {
    return {
      orderId: order.id,
      skipped: true,
      reason: 'No live shipment update available'
    }
  }

  return applyShiprocketOrderUpdate(order, liveUpdate, options)
}

export async function syncShiprocketOrderById(orderId, options = {}) {
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (error || !order) {
    throw error || new Error('Order not found')
  }

  return syncShiprocketOrder(order, options)
}

export async function syncRecentShiprocketOrders({ limit = 25, lookbackDays = 30 } = {}) {
  const cutoffDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString()

  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .or('awb_code.not.is.null,shipment_id.not.is.null')
    .gte('created_at', cutoffDate)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  const results = []
  for (const order of orders || []) {
    try {
      results.push(await syncShiprocketOrder(order, { source: 'cron' }))
    } catch (syncError) {
      results.push({
        orderId: order.id,
        error: syncError.message
      })
    }
  }

  return results
}
