# 💰 Zaryah Wallet & Commission System

Complete marketplace wallet system with 5% admin commission, escrow, and seller payouts.

## 🎯 Overview

This system implements industry-standard marketplace payment flow:
- **Customer pays** → Platform holds money (escrow)
- **Order delivered** → Seller wallet credited
- **Seller requests** → Payout to bank account
- **Platform earns** → 5% commission auto-deducted

## 📊 Money Flow Example

```
Order Value: ₹1,000
├── Platform Commission (5%): ₹50
└── Seller Gets (95%): ₹950

Status Flow:
1. Payment Success → ₹950 to Seller's PENDING balance
2. Order Delivered → ₹950 moves to AVAILABLE balance
3. Seller Withdraws → ₹950 sent to bank account
```

## 🗄️ Database Schema

### Tables Created

#### 1. **wallets**
Stores seller wallet balances
```sql
- seller_id (UUID, FK to sellers)
- available_balance (can withdraw)
- pending_balance (awaiting delivery)
- total_earned (lifetime earnings)
- total_withdrawn (lifetime withdrawals)
- last_withdrawal_at
```

#### 2. **transactions**
All wallet transaction history
```sql
- seller_id
- order_id
- amount
- type (credit_pending, credit_available, debit_withdrawal, commission_deducted, reversal_rto)
- status
- description
```

#### 3. **admin_earnings**
Platform commission tracking
```sql
- order_id
- seller_id
- order_amount
- commission_rate (5%)
- commission_amount
- seller_amount
- status (earned, reversed)
```

#### 4. **withdrawal_requests**
Seller payout requests
```sql
- seller_id
- amount (minimum ₹500)
- bank_account_number
- ifsc_code
- account_holder_name
- status (pending, approved, processing, completed, failed, rejected)
- razorpay_payout_id
```

## 🔌 API Endpoints

### Seller APIs

#### `GET /api/wallet`
Get wallet balance and transaction history
```json
{
  "wallet": {
    "available_balance": 5000.00,
    "pending_balance": 2000.00,
    "total_earned": 25000.00,
    "total_withdrawn": 18000.00
  },
  "transactions": [...],
  "withdrawals": [...]
}
```

#### `POST /api/wallet/withdraw`
Request withdrawal (min ₹500)
```json
{
  "amount": 5000,
  "bank_account_number": "1234567890",
  "ifsc_code": "SBIN0001234",
  "account_holder_name": "John Doe",
  "notes": "Weekly payout"
}
```

#### `GET /api/wallet/withdraw`
Get withdrawal history

### Admin APIs

#### `GET /api/admin/withdrawals?status=pending`
View all withdrawal requests

#### `POST /api/admin/withdrawals/[id]/approve`
Approve or reject withdrawal
```json
{
  "action": "approve", // or "reject"
  "rejection_reason": "Optional reason"
}
```

#### `GET /api/admin/earnings?period=month`
View platform commission earnings
```json
{
  "earnings": [...],
  "summary": {
    "total_commission": 50000.00,
    "total_orders": 1000,
    "avg_commission_per_order": 50.00,
    "commission_rate": 5.0
  }
}
```

### Payment APIs

#### `POST /api/payment/create-order`
Create Razorpay order with commission calculation
```json
{
  "amount": 1000,
  "orderId": "uuid",
  "notes": {}
}
// Returns: { order_id, commission_amount, seller_amount }
```

#### `PATCH /api/payment/verify`
Verify payment and credit seller wallet
```json
{
  "razorpay_order_id": "order_xxx",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_signature": "signature",
  "order_id": "uuid"
}
```

### Webhook APIs

#### `POST /api/webhooks/order-status`
Handle order status updates (from Shiprocket or manual)
```json
{
  "order_id": "uuid",
  "status": "delivered", // or "cancelled", "rto"
  "tracking_data": {}
}
```

**Status Handling:**
- `delivered` → Moves pending → available balance
- `cancelled` / `rto` → Reverses pending balance + commission

## 🔐 Security & Compliance

### Implemented Features ✅
- ✅ KYC mandatory for withdrawals
- ✅ Minimum withdrawal: ₹500
- ✅ Commission clearly tracked
- ✅ No wallet-to-wallet transfers
- ✅ No interest on balances
- ✅ Row Level Security (RLS) enabled
- ✅ Sellers see only own data
- ✅ Admins see all data

### Legal Compliance (India)
- You are a **marketplace facilitator**, not a bank
- Collect seller KYC (Aadhar, PAN, GST)
- Show commission in Terms & Conditions
- Don't allow indefinite balance storage (encourage regular withdrawals)

## 🚀 Setup Instructions

### 1. Database Setup
```bash
# Run the migration SQL
psql -U postgres -d zaryah < supabase/wallet_system.sql

# Or in Supabase Dashboard:
# SQL Editor → Paste wallet_system.sql → Run
```

### 2. Environment Variables
```env
# Razorpay Keys
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=xxxxx

# Razorpay Payouts (for seller withdrawals)
RAZORPAY_PAYOUT_ENABLED=true
RAZORPAY_ACCOUNT_NUMBER=your_account_number

# Webhook Security
WEBHOOK_SECRET=your_random_secret_key
```

### 3. Install Dependencies
```bash
npm install razorpay
```

### 4. Test Payment Flow
```javascript
// 1. Create order
const order = await fetch('/api/payment/create-order', {
  method: 'POST',
  body: JSON.stringify({ amount: 1000, orderId: 'uuid' })
})

// 2. Show Razorpay checkout
const options = {
  key: order.key_id,
  amount: order.amount,
  order_id: order.order_id,
  handler: async (response) => {
    // 3. Verify payment
    await fetch('/api/payment/verify', {
      method: 'PATCH',
      body: JSON.stringify({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
        order_id: 'uuid'
      })
    })
  }
}
const rzp = new Razorpay(options)
rzp.open()
```

## 📈 Admin Dashboard Queries

### Total Platform Revenue
```sql
SELECT SUM(commission_amount) as total_commission
FROM admin_earnings
WHERE status = 'earned';
```

### Pending Withdrawals
```sql
SELECT COUNT(*) as pending_count, SUM(amount) as total_amount
FROM withdrawal_requests
WHERE status = 'pending';
```

### Top Earning Sellers
```sql
SELECT s.business_name, w.total_earned
FROM wallets w
JOIN sellers s ON s.id = w.seller_id
ORDER BY w.total_earned DESC
LIMIT 10;
```

## 🔄 Order Status Flow

```
Order Created → Payment → Pending Balance
     ↓
Confirmed → (no wallet change)
     ↓
Dispatched → (no wallet change)
     ↓
Delivered → Available Balance ✅ (seller can withdraw)

OR

Cancelled/RTO → Reverse Pending → Refund Buyer
```

## 💡 Best Practices

### For Sellers
- ✅ Complete KYC before first sale
- ✅ Add bank details accurately
- ✅ Withdraw regularly (weekly/bi-weekly)
- ✅ Check available vs pending balance
- ✅ Track transactions for accounting

### For Admins
- ✅ Process withdrawals within 2-3 business days
- ✅ Verify large withdrawal requests
- ✅ Monitor commission earnings
- ✅ Handle failed payouts promptly
- ✅ Keep audit trail of all actions

### For Development
- ✅ Test with Razorpay test mode first
- ✅ Use webhook secret for security
- ✅ Handle edge cases (insufficient balance, failed payouts)
- ✅ Log all financial transactions
- ✅ Add monitoring/alerts for high-value operations

## 🧪 Testing Checklist

- [ ] Payment creates pending balance
- [ ] Delivery moves to available balance
- [ ] Withdrawal deducts from available
- [ ] Cancelled order reverses pending
- [ ] Commission calculated correctly (5%)
- [ ] RLS prevents unauthorized access
- [ ] Minimum withdrawal enforced (₹500)
- [ ] KYC required for withdrawal
- [ ] Admin can approve/reject withdrawals
- [ ] Razorpay payout integration works
- [ ] Webhook handles all statuses
- [ ] Transaction history accurate

## 📞 Integration with Shiprocket

To auto-update order status from Shiprocket:

1. Go to Shiprocket Dashboard → Settings → Webhooks
2. Add webhook URL: `https://your-domain.com/api/webhooks/order-status`
3. Add header: `x-webhook-signature: your_secret_key`
4. Select events: Order Delivered, Order Cancelled, RTO

## 🆘 Troubleshooting

### Wallet not created for seller
```sql
INSERT INTO wallets (seller_id) VALUES ('seller_uuid');
```

### Balance mismatch
Check transactions table:
```sql
SELECT * FROM transactions WHERE seller_id = 'uuid' ORDER BY created_at DESC;
```

### Withdrawal stuck in pending
Check:
1. Available balance sufficient?
2. Razorpay credentials configured?
3. Bank details valid?

## 🎓 Learning Resources

- [Razorpay API Docs](https://razorpay.com/docs/api/)
- [Razorpay Payouts](https://razorpay.com/docs/payouts/)
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)
- [Marketplace Payment Flows](https://stripe.com/docs/connect)

## 📝 License & Credits

Built for Zaryah Marketplace
System inspired by Amazon, Etsy, and Meesho payment models
Uses Razorpay for payment processing
