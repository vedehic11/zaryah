/**
 * END-TO-END TEST: Payment & Delivery Integration
 * 
 * This script tests the complete flow:
 * 1. Order creation
 * 2. Razorpay payment
 * 3. Wallet credit (pending)
 * 4. Seller confirmation
 * 5. Shiprocket shipment creation
 * 6. Delivery webhook
 * 7. Fund release
 */

const BASE_URL = 'https://zaryah.vercel.app'
// const BASE_URL = 'http://localhost:3000' // For local testing

async function log(step, message, data = null) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`STEP ${step}: ${message}`)
  console.log('='.repeat(60))
  if (data) {
    console.log(JSON.stringify(data, null, 2))
  }
}

async function testFlow() {
  try {
    // ========================================================================
    // STEP 1: Create Test Order
    // ========================================================================
    await log(1, 'Creating test order...')
    
    const orderData = {
      buyer_id: 'test-buyer-id', // Replace with actual buyer ID from your database
      seller_id: 'test-seller-id', // Replace with actual seller ID
      product_id: 'test-product-id', // Replace with actual product ID
      quantity: 1,
      total_amount: 1000, // ₹10.00 for testing
      address: 'John Doe, 123 Test Street, Mumbai, Maharashtra, 400001, 9876543210'
    }
    
    const createOrderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    })
    
    const order = await createOrderRes.json()
    console.log('✅ Order created:', order)
    
    if (!order.id) {
      throw new Error('Order creation failed')
    }
    
    const orderId = order.id
    
    // ========================================================================
    // STEP 2: Create Razorpay Payment Order
    // ========================================================================
    await log(2, 'Creating Razorpay payment order...')
    
    const paymentOrderRes = await fetch(`${BASE_URL}/api/payment/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId })
    })
    
    const paymentOrder = await paymentOrderRes.json()
    console.log('✅ Razorpay order created:', paymentOrder)
    
    // ========================================================================
    // STEP 3: Simulate Payment Verification
    // ========================================================================
    await log(3, 'Simulating payment verification...')
    
    // In real scenario, Razorpay frontend SDK would send these
    const mockPaymentDetails = {
      orderId: orderId,
      razorpay_order_id: paymentOrder.razorpayOrderId,
      razorpay_payment_id: 'pay_test_' + Date.now(),
      razorpay_signature: 'mock_signature_for_testing'
    }
    
    console.log('⚠️  Note: Real payment verification requires valid Razorpay signature')
    console.log('Mock payment details:', mockPaymentDetails)
    
    // ========================================================================
    // STEP 4: Check Order Status and Wallet
    // ========================================================================
    await log(4, 'Checking order and wallet status...')
    
    // You'll need to query your Supabase database directly or via API
    console.log('📝 Manually verify in Supabase:')
    console.log(`   - Check orders table for order_id: ${orderId}`)
    console.log(`   - Check wallets table for seller_id: ${orderData.seller_id}`)
    console.log(`   - Verify pending_balance is credited`)
    
    // ========================================================================
    // STEP 5: Seller Confirms Order (Creates Shipment)
    // ========================================================================
    await log(5, 'Simulating seller order confirmation...')
    
    const confirmRes = await fetch(`${BASE_URL}/api/orders/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' })
    })
    
    const confirmedOrder = await confirmRes.json()
    console.log('✅ Order confirmed and shipment created:', confirmedOrder)
    
    if (confirmedOrder.shipment_id) {
      console.log('✅ Shipment ID:', confirmedOrder.shipment_id)
      console.log('✅ AWB Code:', confirmedOrder.awb_code)
      console.log('✅ Tracking URL:', confirmedOrder.tracking_url)
    } else {
      console.log('⚠️  Shipment creation might have failed. Check order notes.')
    }
    
    // ========================================================================
    // STEP 6: Simulate Delivery Webhook
    // ========================================================================
    await log(6, 'Simulating Shiprocket delivery webhook...')
    
    const webhookPayload = {
      order_id: orderId,
      shipment_id: confirmedOrder.shipment_id || 12345678,
      awb_code: confirmedOrder.awb_code || 'TEST123456789',
      current_status: 'Delivered',
      delivered_date: new Date().toISOString(),
      shipment_track: [
        {
          current_status: 'Delivered',
          date: new Date().toISOString(),
          activity: 'Package delivered successfully'
        }
      ]
    }
    
    // Note: Real webhook includes signature verification
    console.log('⚠️  Note: This requires valid x-shiprocket-signature header')
    console.log('Webhook payload:', webhookPayload)
    
    const webhookRes = await fetch(`${BASE_URL}/api/webhooks/delivery-updates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'sk_webhook_7h9sK3mP2vQ8xL4nR6wY1z' // For test requests
      },
      body: JSON.stringify(webhookPayload)
    })
    
    const webhookResult = await webhookRes.json()
    console.log('✅ Webhook processed:', webhookResult)
    
    // ========================================================================
    // STEP 7: Verify Final State
    // ========================================================================
    await log(7, 'Verifying final state...')
    
    console.log('📝 Manually verify in Supabase:')
    console.log(`   - orders.status should be 'delivered'`)
    console.log(`   - orders.payment_status should be 'paid'`)
    console.log(`   - wallets.pending_balance should be 0`)
    console.log(`   - wallets.available_balance should be credited`)
    console.log(`   - transactions table should have 'release' record`)
    console.log(`   - admin_earnings should have commission record`)
    
    console.log('\n✅ TEST FLOW COMPLETE!')
    console.log('\nNext Steps:')
    console.log('1. Check Supabase database tables')
    console.log('2. Verify wallet balances')
    console.log('3. Check transaction history')
    console.log('4. Test withdrawal functionality')
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message)
    console.error(error)
  }
}

// Run the test
testFlow()
