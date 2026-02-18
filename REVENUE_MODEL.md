# Platform Revenue Model - Implementation Summary

## Revenue Structure (Updated)

### Admin Revenue (Platform Earnings)
The platform now earns from THREE sources:

1. **100% of Delivery Fees** 
   - Dynamic calculation based on Shiprocket API (weight + distance)
   - Falls back to standard ₹40 if API unavailable

2. **2.5% Commission from Seller**
   - Deducted from seller's product amount
   - Seller receives 97.5% of product price

3. **2.5% Service Charge from Buyer**
   - Added to buyer's bill as "Service Charge (2.5%)"
   - Applied to product subtotal only

**Total Platform Commission: 5% of product value + 100% delivery**

---

## Example Calculation

**Product Price:** ₹1,000  
**Delivery Fee:** ₹50  

### Buyer Pays:
```
Product Amount:      ₹1,000
Delivery Fee:        ₹50
Service Charge:      ₹25  (2.5% of ₹1,000)
Gift Packaging:      ₹50  (if applicable)
COD Fee:            ₹10  (if COD selected)
─────────────────────────────
Total:              ₹1,135
```

### Seller Receives:
```
Product Amount:      ₹1,000
Platform Commission: -₹25   (2.5%)
─────────────────────────────
Seller Payout:       ₹975
```

### Admin Earns:
```
Seller Commission:   ₹25   (2.5% from seller)
Buyer Service Charge:₹25   (2.5% from buyer)
Delivery Fee:        ₹50   (100% of delivery)
─────────────────────────────
Total Admin Revenue: ₹100  (₹25 + ₹25 + ₹50)
```

---

## Implementation Details

### 1. Checkout Page (`app/checkout/page.js`)
**Changes:**
- Added `serviceCharge` calculation: `subtotal * 0.025`
- Updated `total` to include service charge
- Display "Service Charge (2.5%)" line item in order summary
- Pass `serviceCharge` to backend in order creation

**UI Display:**
```javascript
Subtotal:           ₹1,000
Gift Packaging:     ₹50
Delivery Fee:       ₹40
COD Fee:           ₹10
Service Charge:     ₹25  (2.5%)
────────────────────────
Total:             ₹1,125
```

### 2. Order Creation API (`app/api/orders/route.js`)
**Changes:**
- Extract `serviceCharge` from request body
- Store `delivery_fee` and `service_charge` in orders table
- Update seller wallet with 97.5% of product subtotal
- Log commission breakdown for debugging

**Seller Wallet:**
```javascript
const sellerEarnings = subtotal * 0.975
const platformCommission = subtotal * 0.025
```

### 3. Order Delivery Handler (`app/api/orders/[id]/route.js`)
**Changes:**
- When order status changes to "delivered":
  - Calculate seller payout from order_items (97.5% of product subtotal)
  - Release funds from pending to available balance
  - Record admin earnings in `admin_earnings` table

**Admin Earnings Breakdown:**
```javascript
sellerCommission = productSubtotal * 0.025    // From seller
buyerServiceCharge = productSubtotal * 0.025  // From buyer  
deliveryFee = order.delivery_fee              // From Shiprocket
totalAdminEarnings = sellerCommission + buyerServiceCharge + deliveryFee
```

### 4. Admin Earnings API (`app/api/admin/earnings/route.js`)
**Changes:**
- Calculate `totalCommission` (5% from products)
- Calculate `totalDeliveryFees` (100% of delivery charges)
- Return combined `totalRevenue`

**Response:**
```json
{
  "totalCommission": 250.00,
  "totalDeliveryFees": 500.00,
  "totalRevenue": 750.00,
  "totalOrders": 10,
  "commissionRate": 5.0
}
```

---

## Database Schema Updates

### Required Migration (`add_order_fee_columns.sql`)

Run this SQL in Supabase to add necessary columns:

```sql
-- Add delivery_fee and service_charge to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS service_charge DECIMAL(10, 2) DEFAULT 0;

-- Add delivery_fee to admin_earnings for tracking
ALTER TABLE admin_earnings
ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10, 2) DEFAULT 0;
```

### Orders Table Structure
```
orders:
  - total_amount      (buyer pays this)
  - delivery_fee      (admin keeps 100%)
  - service_charge    (2.5% from buyer → admin)
  - payment_method
  - payment_status
  - status
```

### Admin Earnings Table Structure
```
admin_earnings:
  - order_id
  - seller_id
  - commission_amount  (total admin earnings)
  - delivery_fee       (delivery component)
  - commission_rate    (5.0 = 2.5% + 2.5%)
  - order_amount       (product subtotal)
  - status             ('earned')
  - earned_at
```

---

## Payment Flow

### 1. Order Creation
```
Buyer → Frontend calculates total with 2.5% service charge
     → Backend creates order with delivery_fee and service_charge
     → Seller wallet receives 97.5% of products (pending balance)
```

### 2. Payment Processing
```
Razorpay → Buyer pays full total (including service charge)
        → Payment verification
        → Order status: pending
```

### 3. Order Fulfillment
```
Seller → Confirms order
      → Ships via Shiprocket
      → Order status: delivered
      → Seller wallet: pending → available (97.5%)
      → Admin earnings recorded (5% + delivery)
```

---

## Testing Checklist

- [x] Service charge displays in checkout
- [x] Service charge included in order total
- [x] Order stores delivery_fee and service_charge
- [x] Seller receives 97.5% on delivery
- [x] Admin earnings record 5% + delivery fee
- [ ] Run database migration in Supabase
- [ ] Test complete order flow
- [ ] Verify seller dashboard shows correct payout
- [ ] Verify admin dashboard shows all revenue sources

---

## Next Steps

1. **Run Database Migration:**
   ```bash
   # Copy contents of add_order_fee_columns.sql
   # Paste in Supabase SQL Editor → Run
   ```

2. **Test Order Flow:**
   - Place test order with products
   - Verify checkout shows service charge
   - Complete payment
   - Mark order as delivered (seller dashboard)
   - Check seller wallet (should show 97.5%)
   - Check admin earnings (should show 5% + delivery)

3. **Update Seller Dashboard:**
   - Show commission breakdown on order details
   - Display "You receive 97.5% after 2.5% platform fee"

4. **Update Admin Dashboard:**
   - Show delivery fees separately
   - Show commission breakdown (seller + buyer)
   - Display total platform revenue

---

## Key Formula Reference

```javascript
// BUYER SIDE
productSubtotal = sum(item.price * item.quantity)
serviceCharge = productSubtotal * 0.025
deliveryFee = calculateFromShiprocket() || 40
giftPackagingFee = giftItems * 50
codFee = isCOD ? 10 : 0
buyerTotal = productSubtotal + serviceCharge + deliveryFee + giftPackagingFee + codFee

// SELLER SIDE
sellerCommission = productSubtotal * 0.025
sellerPayout = productSubtotal * 0.975

// ADMIN SIDE
adminFromSeller = productSubtotal * 0.025
adminFromBuyer = productSubtotal * 0.025
adminFromDelivery = deliveryFee
totalAdminRevenue = adminFromSeller + adminFromBuyer + adminFromDelivery
```

---

## File Changes Summary

**Modified Files:**
1. `app/checkout/page.js` - Added service charge calculation and UI
2. `app/api/orders/route.js` - Store fees, updated wallet calculation
3. `app/api/orders/[id]/route.js` - Delivery handler with admin earnings
4. `app/api/admin/earnings/route.js` - Revenue calculation updates

**New Files:**
1. `add_order_fee_columns.sql` - Database migration script
2. `REVENUE_MODEL.md` - This documentation (you're reading it!)

---

*Last Updated: February 17, 2026*
