# Payment Configuration Guide

## Current Status
✅ **COD (Cash on Delivery)** - Working and set as default
⚠️ **Online Payment** - Requires Razorpay configuration

## Setting Up Razorpay (Optional)

If you want to enable online payments (UPI, Cards, Netbanking), follow these steps:

### 1. Create Razorpay Account
1. Go to [https://razorpay.com](https://razorpay.com)
2. Sign up for a free account
3. Complete KYC verification (required for live mode)

### 2. Get API Keys
1. Login to Razorpay Dashboard
2. Go to **Settings** → **API Keys**
3. Click **Generate Test Key** (for testing) or **Generate Live Key** (for production)
4. You'll get:
   - **Key ID** (starts with `rzp_test_` or `rzp_live_`)
   - **Key Secret** (keep this confidential!)

### 3. Configure Environment Variables

Create a `.env.local` file in the `Zaryah_Frontend` folder:

```env
# Razorpay Keys
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_your_key_id_here
RAZORPAY_KEY_SECRET=your_key_secret_here

# Your existing Supabase config
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Restart Development Server

```powershell
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

### 5. Test Payment Flow

1. Add items to cart
2. Go to checkout
3. Select "Online Payment" (should now be enabled)
4. Use Razorpay test card: `4111 1111 1111 1111`
5. CVV: Any 3 digits
6. Expiry: Any future date

## What Happens Without Razorpay?

✅ **COD orders work perfectly** - Orders are created and sellers can confirm them
⚠️ **Online Payment is disabled** - Shows "Coming Soon" badge
💡 **Automatic fallback** - COD is selected by default

## Database Schema

The orders table supports both payment methods:
- `payment_method`: 'cod' or 'online'
- `payment_id`: NULL for COD, Razorpay payment ID for online
- `payment_status`: 'pending', 'completed', 'failed'

## Commission & Wallet System

When online payment is configured:
- Platform commission: 5% of order value
- Seller receives: 95% in their wallet
- Automatic commission calculation
- Wallet withdrawal via Razorpay transfers

## Need Help?

- Razorpay Docs: https://razorpay.com/docs/
- Test Mode: Safe for development, no real money
- Live Mode: Requires KYC and business verification

---

**For now, you can use COD to test the complete order flow!**
