# Database Setup - Payment & Delivery Integration

## 🚀 Quick Setup (3 Steps)

### Step 1: Run Database Migration
Open Supabase SQL Editor and run: **`database/01_migration_payment_delivery.sql`**

This creates/updates:
- ✅ Orders table (payment & shipment columns)
- ✅ Wallets table
- ✅ Transactions table
- ✅ Admin earnings table
- ✅ Withdrawal requests table
- ✅ Row Level Security policies
- ✅ Indexes for performance

### Step 2: Create Wallet Functions
Run: **`database/02_wallet_functions.sql`**

This creates:
- ✅ `credit_seller_wallet_pending()` - Add pending balance on payment
- ✅ `release_seller_wallet_funds()` - Release funds on delivery
- ✅ `debit_seller_wallet()` - Debit for withdrawals
- ✅ `get_seller_wallet_summary()` - Wallet overview

### Step 3: Test the Integration
```sql
-- Check if everything is set up
SELECT 
  'orders' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'orders'
  AND column_name IN (
    'razorpay_order_id', 'payment_status', 'shipment_id', 
    'awb_code', 'commission_amount', 'seller_amount'
  );

-- Should return 6 rows
```

---

## 📋 Complete Order & Payment Flow

### Current Implementation (As Per Your Requirement):

```
┌─────────────────────────────────────────────────────────────┐
│ BUYER PLACES ORDER                                          │
├─────────────────────────────────────────────────────────────┤
│ • COD: status='pending', payment_status='pending'           │
│ • Online: Payment modal opens                               │
│   - Success: status='pending', payment_status='paid'        │
│   - Failure/Cancel: Order remains but not paid              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ SELLER REVIEWS & CONFIRMS ORDER (MANUAL)                    │
├─────────────────────────────────────────────────────────────┤
│ • Seller clicks "Confirm" in dashboard                      │
│ • Shipment automatically created in Shiprocket              │
│ • AWB code assigned → status='dispatched'                   │
│ • Tracking URL sent to buyer                                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ DELIVERY CONFIRMATION                                       │
├─────────────────────────────────────────────────────────────┤
│ • Shiprocket webhook OR seller marks delivered              │
│ • status='delivered'                                        │
│ • Online orders: Release pending funds to seller            │
│ • COD orders: payment_status='paid'                         │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚠️ Important Notes

1. **Seller Confirmation Required**: Shipments are ONLY created when seller manually confirms the order
2. **No Auto-Confirmation**: Even for paid orders, seller must review and confirm
3. **Funds on Hold**: Online payment funds stay "pending" until delivery confirmation
4. **COD Tracking**: Payment marked as "paid" only after delivery

---

## 🚀 Deployment Steps

1. **Deploy Code Changes**: Push to production
2. **Run SQL Scripts**: Execute wallet release function in Supabase
3. **Verify Tables**: Check all required columns exist
4. **Test Webhooks**: Configure Shiprocket webhook URL
5. **Monitor First Orders**: Watch logs for any issues

---

## 📞 Support

If you encounter any issues:
1. Check Supabase logs for database errors
2. Check application logs for API errors
3. Verify Shiprocket credentials are correct
4. Test webhook endpoint is accessible from internet
