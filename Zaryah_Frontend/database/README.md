# 🚀 DATABASE SETUP - QUICK START GUIDE

## ⚡ 3-Step Setup Process

### Step 1️⃣: Run Main Migration
**File:** `database/01_migration_payment_delivery.sql`

Open your Supabase SQL Editor and paste the entire contents of this file.

**What it does:**
- ✅ Adds payment columns to orders table (razorpay_order_id, payment_status, etc.)
- ✅ Adds shipment columns to orders table (shipment_id, awb_code, tracking_url, etc.)
- ✅ Creates/verifies wallets table
- ✅ Creates/verifies transactions table
- ✅ Creates admin_earnings table
- ✅ Creates withdrawal_requests table
- ✅ Sets up Row Level Security policies
- ✅ Creates indexes for performance
- ✅ Adds address columns to sellers and buyers tables

**Time:** ~30 seconds

---

### Step 2️⃣: Create Wallet Functions
**File:** `database/02_wallet_functions.sql`

Run this immediately after Step 1.

**What it creates:**
- ✅ `credit_seller_wallet_pending()` - Credits pending balance when payment received
- ✅ `release_seller_wallet_funds()` - Releases funds when order delivered
- ✅ `debit_seller_wallet()` - Debits wallet for withdrawals
- ✅ `get_seller_wallet_summary()` - Gets wallet overview

**Time:** ~10 seconds

---

### Step 3️⃣: Verify Setup
**File:** `database/03_verify_setup.sql`

Run this to check everything is working.

**What it checks:**
- ✅ All tables exist
- ✅ All columns exist
- ✅ All functions exist
- ✅ Indexes are created
- ✅ Table structures are correct

**Time:** ~5 seconds

---

## 🎯 What You Get

### Payment Integration ✅
```
Buyer pays ₹100
    ↓
Platform: ₹5 (commission)
Seller: ₹95 (pending until delivery)
    ↓
Order delivered
    ↓
Seller: ₹95 (available for withdrawal)
```

### Delivery Integration ✅
```
Seller confirms order
    ↓
Shiprocket shipment created automatically
    ↓
AWB code assigned
    ↓
Tracking URL available
    ↓
Webhook updates order status
```

### Wallet System ✅
```
Payment received → pending_balance
Order delivered → available_balance
Withdrawal request → debit available_balance
```

---

## 🔍 Troubleshooting

### "Function already exists" error?
**Solution:** Good! It means the function was already created. Continue to next step.

### "Column already exists" error?
**Solution:** Good! Your database already has that column. Continue to next step.

### "Table already exists" error?
**Solution:** Good! The script will just update it with missing columns. Continue to next step.

### Any other error?
1. Check the error message
2. Look at the line number mentioned
3. Run that specific section again
4. Contact support if needed

---

## ✅ Success Checklist

After running all 3 scripts, you should see:

- [ ] No ❌ marks in verification output
- [ ] All tables exist
- [ ] All 4 wallet functions created
- [ ] Orders table has payment & shipment columns
- [ ] Wallets table has pending_balance and available_balance
- [ ] Transactions table has status column
- [ ] Admin_earnings table exists

---

## 🧪 Quick Test

Run this to test the wallet system:

```sql
-- 1. Check if functions work (will error if seller doesn't exist, that's OK)
SELECT 'Functions are working!' as status
WHERE EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'credit_seller_wallet_pending')
  AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'release_seller_wallet_funds');

-- 2. Check tables
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('orders', 'wallets', 'transactions', 'admin_earnings')
ORDER BY table_name;
```

Expected output:
```
✅ Functions are working!
✅ admin_earnings - 9 columns
✅ orders - 20+ columns
✅ transactions - 8 columns
✅ wallets - 8 columns
```

---

## 🎉 You're Done!

Your database is now fully set up for:
- 💳 Razorpay payment processing
- 🚚 Shiprocket delivery integration
- 💰 Seller wallet management
- 📊 Admin commission tracking

Next steps:
1. Test an order flow
2. Check payment verification
3. Confirm wallet updates
4. Test delivery webhook

Need help? Check `DEPLOYMENT_CHECKLIST.md` for the complete integration guide.
