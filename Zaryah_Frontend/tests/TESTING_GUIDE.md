# END-TO-END TESTING GUIDE: Payment & Delivery Integration

## Prerequisites
Before testing, ensure you have:
- [ ] At least one seller account with complete address
- [ ] At least one buyer account  
- [ ] At least one product listed by the seller
- [ ] Razorpay test keys configured in Vercel
- [ ] Shiprocket credentials configured
- [ ] Webhook configured in Shiprocket dashboard

---

## Test 1: Database Setup Verification ✅

Run this in Supabase SQL Editor:

```sql
-- Check sellers with complete address info
SELECT id, email, city, state, pincode, business_address 
FROM sellers 
LIMIT 5;

-- Check buyers
SELECT id, email 
FROM buyers 
LIMIT 5;

-- Check products
SELECT id, title, price, seller_id 
FROM products 
LIMIT 5;

-- Check if wallets exist
SELECT * FROM wallets LIMIT 5;
```

**Expected Result:** All tables should have data

---

## Test 2: Place Order via Frontend 🛒

### Steps:
1. Go to https://zaryah.vercel.app/
2. Browse products and add to cart
3. Go to checkout
4. Fill in delivery address (use real format):
   ```
   John Doe
   123 Test Street
   Mumbai
   Maharashtra
   400001
   9876543210
   ```
5. Click "Place Order"
6. Complete Razorpay payment (use test card in test mode)

### Verify in Supabase:
```sql
-- Get the latest order
SELECT * FROM orders ORDER BY created_at DESC LIMIT 1;

-- Should show:
-- ✅ razorpay_order_id populated
-- ✅ razorpay_payment_id populated  
-- ✅ payment_status = 'paid'
-- ✅ commission_amount = total_amount * 0.05
-- ✅ seller_amount = total_amount * 0.95
-- ✅ status = 'pending'
```

---

## Test 3: Verify Wallet Credited ✅

```sql
-- Check seller's wallet
SELECT 
  w.*,
  s.email as seller_email
FROM wallets w
JOIN sellers s ON w.seller_id = s.id
WHERE w.seller_id = 'YOUR_SELLER_ID'; -- Replace with actual seller ID

-- Check pending balance is credited
-- Should see: pending_balance = seller_amount from order
```

**Expected:** Seller's `pending_balance` increased by `seller_amount`

---

## Test 4: Seller Confirms Order (Shipment Creation) 📦

### Option A: Via Seller Dashboard
1. Login as seller
2. Go to seller dashboard
3. Find the pending order
4. Click "Confirm Order"

### Option B: Via API (PowerShell)
```powershell
$orderId = "YOUR_ORDER_ID"  # Get from database
$body = @{ status = "confirmed" } | ConvertTo-Json

Invoke-WebRequest `
  -Uri "https://zaryah.vercel.app/api/orders/$orderId" `
  -Method PUT `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
```

### Verify in Supabase:
```sql
SELECT 
  id,
  status,
  shipment_id,
  awb_code,
  tracking_url,
  courier_name,
  notes
FROM orders 
WHERE id = 'YOUR_ORDER_ID';

-- Should show:
-- ✅ status = 'dispatched' (if AWB assigned) OR 'confirmed' (if failed)
-- ✅ shipment_id populated
-- ✅ awb_code populated
-- ✅ tracking_url populated
-- ✅ courier_name populated
```

### Verify in Shiprocket:
- Login to Shiprocket dashboard
- Check "Orders" section
- Should see new order with AWB code

---

## Test 5: Simulate Delivery (Webhook) 🚚

Since you can't actually deliver the package instantly, simulate the webhook:

```powershell
# Simulate delivery webhook
$webhookPayload = @{
  order_id = "YOUR_ORDER_ID"
  shipment_id = 12345678
  awb_code = "TEST123456"
  current_status = "Delivered"
  delivered_date = (Get-Date).ToString("o")
  shipment_track = @(
    @{
      current_status = "Delivered"
      date = (Get-Date).ToString("o")
      activity = "Package delivered successfully"
    }
  )
} | ConvertTo-Json -Depth 3

Invoke-WebRequest `
  -Uri "https://zaryah.vercel.app/api/webhooks/delivery-updates" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "x-api-key" = "sk_webhook_7h9sK3mP2vQ8xL4nR6wY1z"
  } `
  -Body $webhookPayload
```

### Verify Fund Release:
```sql
-- Check order status updated
SELECT 
  id,
  status,
  payment_status
FROM orders 
WHERE id = 'YOUR_ORDER_ID';
-- Should show:
-- ✅ status = 'delivered'
-- ✅ payment_status = 'paid'

-- Check wallet - funds moved from pending to available
SELECT 
  pending_balance,
  available_balance,
  total_earned
FROM wallets 
WHERE seller_id = 'YOUR_SELLER_ID';
-- Should show:
-- ✅ pending_balance decreased
-- ✅ available_balance increased
-- ✅ total_earned increased

-- Check transaction record
SELECT * FROM transactions 
WHERE order_id = 'YOUR_ORDER_ID' 
ORDER BY created_at DESC;
-- Should have:
-- ✅ type = 'credit' (when order placed)
-- ✅ type = 'release' (when delivered)

-- Check admin commission
SELECT * FROM admin_earnings 
WHERE order_id = 'YOUR_ORDER_ID';
-- Should show:
-- ✅ commission_amount = order.commission_amount
-- ✅ order_id matches
```

---

## Test 6: Verify Complete Flow ✅

Final verification checklist:

```sql
-- Complete order journey
SELECT 
  o.id,
  o.status,
  o.payment_status,
  o.total_amount,
  o.commission_amount,
  o.seller_amount,
  o.shipment_id,
  o.awb_code,
  w.pending_balance,
  w.available_balance,
  COUNT(t.id) as transaction_count
FROM orders o
LEFT JOIN wallets w ON w.seller_id = o.seller_id
LEFT JOIN transactions t ON t.order_id = o.id
WHERE o.id = 'YOUR_ORDER_ID'
GROUP BY o.id, w.id;
```

**Expected Results:**
- ✅ Order status: `delivered`
- ✅ Payment status: `paid`
- ✅ Shipment ID exists
- ✅ AWB code exists
- ✅ Pending balance: 0 (or lower than before)
- ✅ Available balance: increased by seller_amount
- ✅ Transaction count: 2 (credit + release)

---

## Common Issues & Solutions 🔧

### Issue 1: Shipment Creation Fails
**Check:**
- Seller has complete address (city, state, pincode, business_address)
- Shiprocket credentials are correct
- Order address is in correct format

**Fix:** Update seller address in database:
```sql
UPDATE sellers 
SET 
  city = 'Mumbai',
  state = 'Maharashtra',
  pincode = '400001',
  business_address = '123 Business Street'
WHERE id = 'YOUR_SELLER_ID';
```

### Issue 2: Webhook Not Working
**Check:**
- Webhook URL configured in Shiprocket
- Token matches exactly in both places
- Endpoint returns 200 OK on test

**Test webhook:**
```powershell
Invoke-WebRequest `
  -Uri "https://zaryah.vercel.app/api/webhooks/delivery-updates" `
  -Method POST `
  -Headers @{"x-api-key"="sk_webhook_7h9sK3mP2vQ8xL4nR6wY1z"}
```

### Issue 3: Funds Not Released
**Check:**
```sql
-- Check if release function was called
SELECT * FROM transactions 
WHERE order_id = 'YOUR_ORDER_ID' 
AND type = 'release';

-- If missing, manually release:
SELECT release_seller_wallet_funds('YOUR_ORDER_ID');
```

---

## Success Criteria ✅

All tests pass if:
- [x] Order creates successfully with payment
- [x] Wallet pending balance credited
- [x] Seller can confirm order
- [x] Shiprocket shipment auto-created
- [x] AWB code assigned
- [x] Webhook processes delivery event
- [x] Funds moved from pending to available
- [x] Order marked as delivered and paid
- [x] Commission recorded in admin_earnings
- [x] All transactions logged

---

## Next Steps 🚀

After successful testing:
1. Test withdrawal functionality
2. Test multiple concurrent orders
3. Test cancellation flow
4. Test RTO (Return to Origin) handling
5. Add buyer/seller notifications
6. Monitor production logs

---

**Need Help?** Check:
- Vercel deployment logs
- Supabase database logs  
- Shiprocket dashboard
- Browser console for frontend errors
