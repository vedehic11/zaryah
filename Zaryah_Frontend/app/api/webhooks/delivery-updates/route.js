// Shiprocket webhook endpoint
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyWebhookSignature, mapShiprocketStatus } from '@/lib/shiprocket'

export async function POST(request) {
  try {
    console.log('=== Shiprocket Webhook Received ===')
    
    // Get raw body for signature verification
    const rawBody = await request.text()
    const signature = request.headers.get('x-shiprocket-signature')
    const apiKey = request.headers.get('x-api-key')
    
    console.log('Signature present:', !!signature)
    console.log('API Key present:', !!apiKey)
    console.log('Raw body length:', rawBody.length)
    
    // Handle Shiprocket test/ping requests (uses x-api-key header with token)
    if (apiKey) {
      const expectedToken = process.env.SHIPROCKET_WEBHOOK_SECRET
      if (apiKey === expectedToken) {
        console.log('✅ Shiprocket test request authenticated via x-api-key')
        return NextResponse.json({ 
          success: true,
          message: 'Webhook endpoint is active and ready to receive events'
        }, { status: 200 })
      } else {
        console.error('Invalid x-api-key token')
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
      }
    }
    
    // Handle empty body test requests (legacy format)
    if (!rawBody || rawBody.trim() === '' || rawBody === '{}') {
      console.log('✅ Shiprocket test/ping request - responding OK')
      return NextResponse.json({ 
        success: true,
        message: 'Webhook endpoint is active and ready to receive events'
      }, { status: 200 })
    }
    
    // SECURITY: Require signature for actual webhook events
    if (!signature) {
      console.error('Missing webhook signature for non-empty payload')
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }
    
    // Verify webhook signature
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error('Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    
    const payload = JSON.parse(rawBody)
    console.log('Webhook payload:', JSON.stringify(payload, null, 2))
    
    // Extract shipment details from payload
    const {
      order_id,
      shipment_id,
      awb_code,
      courier_name,
      current_status,
      delivered_date,
      shipment_track
    } = payload
    
    if (!order_id && !shipment_id) {
      console.error('Missing order_id or shipment_id in webhook')
      return NextResponse.json({ error: 'Missing order or shipment ID' }, { status: 400 })
    }
    
    // Find order by order_id or shipment_id
    let query = supabase.from('orders').select('*')
    
    if (order_id) {
      query = query.eq('id', order_id)
    } else {
      query = query.eq('shipment_id', shipment_id)
    }
    
    const { data: order, error: fetchError } = await query.single()
    
    if (fetchError || !order) {
      console.error('Order not found:', order_id || shipment_id)
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    
    console.log('Order found:', order.id)
    
    // Map Shiprocket status to internal order status
    const statusMapping = mapShiprocketStatus(current_status)
    const { status: newStatus, isRTO, requiresRefund } = statusMapping
    
    console.log('Status mapping:', { 
      shiprocketStatus: current_status, 
      newStatus, 
      isRTO, 
      requiresRefund 
    })
    
    const updates = {
      shipment_status: current_status
    }
    
    // Update order status if mapping exists
    if (newStatus) {
      updates.status = newStatus
      console.log(`Updating order status from ${order.status} to ${newStatus}`)
      
      // Add RTO notes if applicable
      if (isRTO) {
        updates.notes = `⚠️ RTO (Return to Origin): Package could not be delivered and is being returned to seller. Reason: ${current_status}. Buyer will be refunded.`
        console.log('🔄 RTO detected - will process refund')
      } else if (requiresRefund && newStatus === 'cancelled') {
        updates.notes = `⚠️ Order ${current_status}: Shipment failed. Buyer will be refunded.`
        console.log('💸 Cancellation detected - will process refund')
      }
    }
    
    // Update AWB and courier if provided
    if (awb_code && !order.awb_code) {
      updates.awb_code = awb_code
      updates.tracking_url = `https://shiprocket.co/tracking/${awb_code}`
    }
    
    if (courier_name && !order.courier_name) {
      updates.courier_name = courier_name
    }
    
    // Update delivery date if delivered
    if (delivered_date && newStatus === 'delivered') {
      updates.updated_at = new Date(delivered_date).toISOString()
    }
    
    // Update order
    const { error: updateError } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', order.id)
    
    if (updateError) {
      console.error('Failed to update order:', updateError)
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
    }
    
    console.log('Order updated successfully')
    
    // Handle RTO or failed delivery - process refund
    if (requiresRefund && newStatus === 'cancelled' && order.payment_status === 'paid') {
      console.log('📋 Processing refund for failed/RTO delivery...')
      
      try {
        // Only refund online payments (COD doesn't need refund)
        if (order.payment_method === 'online' && order.razorpay_payment_id) {
          console.log('💳 Initiating Razorpay refund...')
          
          // Calculate refund amount (full order total for buyer)
          const refundAmount = Math.round(parseFloat(order.total_amount) * 100) // Convert to paise
          
          try {
            const Razorpay = require('razorpay')
            const razorpay = new Razorpay({
              key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
              key_secret: process.env.RAZORPAY_KEY_SECRET
            })
            
            const refund = await razorpay.payments.refund(order.razorpay_payment_id, {
              amount: refundAmount,
              notes: {
                reason: isRTO ? 'RTO - Return to Origin' : 'Shipment Failed',
                order_id: order.id,
                shipment_status: current_status
              }
            })
            
            console.log('✅ Razorpay refund initiated:', refund.id)
            
            // Update order payment status
            await supabase
              .from('orders')
              .update({ 
                payment_status: 'refunded',
                notes: (updates.notes || '') + `\n💰 Refund initiated: ₹${(refundAmount/100).toFixed(2)} (ID: ${refund.id})`
              })
              .eq('id', order.id)
              
          } catch (refundError) {
            console.error('❌ Razorpay refund failed:', refundError)
            
            // Log refund failure but don't fail webhook
            await supabase
              .from('orders')
              .update({ 
                notes: (updates.notes || '') + `\n⚠️ Auto-refund failed: ${refundError.message}. Admin needs to process manually.`
              })
              .eq('id', order.id)
          }
        }
        
        // Reverse seller wallet credits if order was already credited
        if (order.wallet_credited && order.seller_amount) {
          console.log('🔄 Reversing seller wallet credit...')
          
          const sellerAmount = parseFloat(order.seller_amount)
          
          // Fetch current wallet balances
          const { data: wallet } = await supabase
            .from('wallets')
            .select('pending_balance, available_balance, total_earned')
            .eq('seller_id', order.seller_id)
            .single()
          
          if (wallet) {
            // Reverse wallet balances (deduct from both pending and available)
            await supabase
              .from('wallets')
              .update({
                available_balance: Math.max(0, parseFloat(wallet.available_balance || 0) - sellerAmount),
                pending_balance: Math.max(0, parseFloat(wallet.pending_balance || 0) - sellerAmount),
                total_earned: Math.max(0, parseFloat(wallet.total_earned || 0) - sellerAmount),
                updated_at: new Date().toISOString()
              })
              .eq('seller_id', order.seller_id)
          }
          
          // Create reversal transaction
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
          
          // Mark order as not credited
          await supabase
            .from('orders')
            .update({ wallet_credited: false })
            .eq('id', order.id)
          
          console.log('✅ Wallet reversal completed: ₹' + sellerAmount)
          
          // Reverse admin earnings
          const { data: adminEarning } = await supabase
            .from('admin_earnings')
            .select('*')
            .eq('order_id', order.id)
            .eq('status', 'earned')
            .single()
            
          if (adminEarning) {
            await supabase
              .from('admin_earnings')
              .update({ 
                status: 'reversed',
                reversed_at: new Date().toISOString()
              })
              .eq('id', adminEarning.id)
              
            console.log('✅ Admin earnings reversed')
          }
        }
        
        // Create notifications for buyer and seller
        const notificationPromises = []
        
        // Notify buyer about refund
        notificationPromises.push(
          supabase.from('notifications').insert({
            user_id: order.buyer_id,
            user_model: 'Buyer',
            title: isRTO ? 'Delivery Failed - Refund Initiated' : 'Order Cancelled - Refund Initiated',
            message: isRTO 
              ? `Your order could not be delivered (${current_status}). ${order.payment_method === 'online' ? 'Refund of ₹' + order.total_amount + ' has been initiated to your payment method.' : 'No payment was collected as this was a COD order.'}`
              : `Your order was cancelled due to shipment failure (${current_status}). ${order.payment_method === 'online' ? 'Refund of ₹' + order.total_amount + ' has been initiated.' : ''}`,
            type: 'order',
            related_order_id: order.id,
            priority: 'high',
            action_url: `/orders`
          })
        )
        
        // Notify seller about RTO/failure
        notificationPromises.push(
          supabase.from('notifications').insert({
            user_id: order.seller_id,
            user_model: 'Seller',
            title: isRTO ? 'RTO - Package Returned' : 'Delivery Failed',
            message: isRTO
              ? `Order was returned to origin (${current_status}). The package will be returned to your pickup location. Buyer has been refunded.`
              : `Delivery failed for order (${current_status}). Buyer has been refunded. No earnings will be credited.`,
            type: 'order',
            related_order_id: order.id,
            priority: 'high',
            action_url: `/seller/dashboard?tab=orders`
          })
        )
        
        await Promise.all(notificationPromises)
        console.log('✅ Notifications sent to buyer and seller')
        
      } catch (refundProcessError) {
        console.error('❌ Error in refund processing:', refundProcessError)
        // Don't fail webhook, just log it
      }
    }
    
    // Handle delivery - release seller funds and update payment status
    if (newStatus === 'delivered') {
      console.log('Processing order delivery from webhook...')
      
      try {
        // Update COD payment status to paid FIRST (before wallet crediting)
        if (order.payment_method === 'cod' && order.payment_status !== 'paid') {
          console.log('Updating COD order payment status to paid...')
          
          await supabase
            .from('orders')
            .update({ payment_status: 'paid' })
            .eq('id', order.id)
          
          // Update local order object
          order.payment_status = 'paid'
          console.log('✅ COD payment marked as paid')
        }
        
        // Release seller wallet funds from pending to available
        if (order.payment_status === 'paid' && order.seller_id && !order.wallet_credited) {
          console.log(`Releasing pending funds for seller ${order.seller_id}...`)
          
          // Calculate seller earnings from order
          const sellerEarnings = parseFloat(order.seller_amount || 0)
          
          if (sellerEarnings > 0) {
            // Fetch current wallet balances
            // NOTE: RACE CONDITION RISK - If multiple deliveries happen simultaneously,
            // wallet updates could overwrite each other. This should be wrapped in a
            // database transaction with row-level locking for production use.
            // Example: SELECT ... FOR UPDATE followed by UPDATE in same transaction
            const { data: wallet } = await supabase
              .from('wallets')
              .select('pending_balance, available_balance, total_earned')
              .eq('seller_id', order.seller_id)
              .single()
            
            if (wallet) {
              // Update wallet balances directly (move from pending to available)
              const { error: walletError } = await supabase
                .from('wallets')
                .update({
                  pending_balance: parseFloat(wallet.pending_balance || 0) - sellerEarnings,
                  available_balance: parseFloat(wallet.available_balance || 0) + sellerEarnings,
                  total_earned: parseFloat(wallet.total_earned || 0) + sellerEarnings,
                  updated_at: new Date().toISOString()
                })
                .eq('seller_id', order.seller_id)
            
            if (walletError) {
              console.error('Wallet fund release failed:', walletError)
            } else {
              // Mark order as wallet credited
              await supabase
                .from('orders')
                .update({ wallet_credited: true })
                .eq('id', order.id)
              
              // Create transaction record
              await supabase
                .from('transactions')
                .insert({
                  seller_id: order.seller_id,
                  order_id: order.id,
                  amount: sellerEarnings,
                  type: 'credit_available',
                  status: 'completed',
                  description: `Order delivered - Funds released to available balance`
                })
              
                console.log('✅ Seller funds released to available balance: ₹' + sellerEarnings)
              }
            } else {
              console.error('Wallet not found for seller:', order.seller_id)
            }
          }
        }
      } catch (deliveryError) {
        console.error('Error processing delivery in webhook:', deliveryError)
        // Don't fail webhook processing, just log the error
      }
      
      // Send delivery notifications to buyer and seller
      try {
        const notificationPromises = []
        
        // Notify buyer about successful delivery
        notificationPromises.push(
          supabase.from('notifications').insert({
            user_id: order.buyer_id,
            user_model: 'Buyer',
            title: 'Order Delivered Successfully! 🎉',
            message: `Your order has been delivered successfully. We hope you love it! Please leave a review to help other buyers.`,
            type: 'delivery',
            related_order_id: order.id,
            priority: 'medium',
            action_url: `/orders`
          })
        )
        
        // Notify seller about delivery and earnings
        notificationPromises.push(
          supabase.from('notifications').insert({
            user_id: order.seller_id,
            user_model: 'Seller',
            title: 'Order Delivered - Earnings Available',
            message: `Your order has been successfully delivered! Earnings are now available in your wallet for withdrawal.`,
            type: 'order',
            related_order_id: order.id,
            priority: 'medium',
            action_url: `/seller/dashboard?tab=wallet`
          })
        )
        
        await Promise.all(notificationPromises)
        console.log('✅ Delivery notifications sent')
      } catch (notifError) {
        console.error('Failed to send delivery notifications:', notifError)
      }
    }
    
    // Send shipment tracking update notifications for status changes
    if (newStatus && newStatus !== order.status && newStatus !== 'delivered' && newStatus !== 'cancelled') {
      try {
        await supabase.from('notifications').insert({
          user_id: order.buyer_id,
          user_model: 'Buyer',
          title: 'Order Status Updated',
          message: `Your order status has been updated to: ${current_status}. ${awb_code ? `Track your shipment: ${awb_code}` : ''}`,
          type: 'delivery',
          related_order_id: order.id,
          priority: 'low',
          action_url: order.tracking_url || `/orders`
        })
        console.log('✅ Tracking update notification sent')
      } catch (notifError) {
        console.error('Failed to send tracking notification:', notifError)
      }
    }
    
    return NextResponse.json({ success: true, message: 'Webhook processed' })
  } catch (error) {
    console.error('=== Webhook Processing Error ===')
    console.error('Error:', error.message)
    console.error('Stack:', error.stack)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Handle GET requests (for webhook verification)
export async function GET(request) {
  return NextResponse.json({ 
    message: 'Shiprocket webhook endpoint', 
    status: 'active' 
  })
}
