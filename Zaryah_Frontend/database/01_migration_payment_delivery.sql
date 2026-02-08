-- Complete Database Migration for Payment & Delivery Integration
-- Run this script in Supabase SQL Editor

-- ============================================================================
-- 1. ADD MISSING COLUMNS TO ORDERS TABLE
-- ============================================================================

-- Payment related columns
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT,
ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS seller_amount DECIMAL(10,2) DEFAULT 0;

-- Shipment related columns
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS shipment_id TEXT,
ADD COLUMN IF NOT EXISTS awb_code TEXT,
ADD COLUMN IF NOT EXISTS tracking_url TEXT,
ADD COLUMN IF NOT EXISTS courier_name TEXT,
ADD COLUMN IF NOT EXISTS shipment_status TEXT,
ADD COLUMN IF NOT EXISTS shipment_created_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id ON orders(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_shipment_id ON orders(shipment_id);
CREATE INDEX IF NOT EXISTS idx_orders_awb_code ON orders(awb_code);

-- ============================================================================
-- 2. CREATE/VERIFY WALLETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id UUID UNIQUE NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  available_balance DECIMAL(10,2) DEFAULT 0 CHECK (available_balance >= 0),
  pending_balance DECIMAL(10,2) DEFAULT 0 CHECK (pending_balance >= 0),
  total_earned DECIMAL(10,2) DEFAULT 0,
  total_withdrawn DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add missing columns if table already exists
ALTER TABLE wallets 
ADD COLUMN IF NOT EXISTS available_balance DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pending_balance DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_earned DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_withdrawn DECIMAL(10,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_wallets_seller_id ON wallets(seller_id);

-- ============================================================================
-- 3. CREATE/VERIFY TRANSACTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'withdrawal')),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add missing columns if table already exists
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_transactions_seller_id ON transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- ============================================================================
-- 4. CREATE ADMIN_EARNINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_earnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  order_amount DECIMAL(10,2) NOT NULL,
  commission_rate DECIMAL(5,2) NOT NULL DEFAULT 5.0,
  commission_amount DECIMAL(10,2) NOT NULL,
  seller_amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'earned' CHECK (status IN ('earned', 'refunded')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_earnings_order_id ON admin_earnings(order_id);
CREATE INDEX IF NOT EXISTS idx_admin_earnings_seller_id ON admin_earnings(seller_id);
CREATE INDEX IF NOT EXISTS idx_admin_earnings_status ON admin_earnings(status);

-- ============================================================================
-- 5. CREATE WITHDRAWAL_REQUESTS TABLE (if doesn't exist)
-- ============================================================================

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  bank_details JSONB,
  requested_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  processed_by UUID REFERENCES buyers(id),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_seller_id ON withdrawal_requests(seller_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);

-- ============================================================================
-- 6. CREATE UPDATED_AT TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to relevant tables
DROP TRIGGER IF EXISTS update_wallets_updated_at ON wallets;
CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_admin_earnings_updated_at ON admin_earnings;
CREATE TRIGGER update_admin_earnings_updated_at
  BEFORE UPDATE ON admin_earnings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 7. VERIFY SELLERS AND BUYERS TABLES HAVE REQUIRED COLUMNS
-- ============================================================================

-- Check if sellers table has required address columns for Shiprocket
ALTER TABLE sellers
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS pincode TEXT,
ADD COLUMN IF NOT EXISTS business_address TEXT;

-- Check if buyers table has required address columns
ALTER TABLE buyers
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS pincode TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS address TEXT;

-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Note: RLS policies are commented out because the auth column name varies by setup
-- You can enable these later after confirming your auth column name
-- Common column names: user_id, userId, supabase_user_id, auth_user_id

-- To enable RLS later, uncomment and update with correct column name:
/*
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Find your auth column name first:
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'sellers' AND column_name LIKE '%user%';

-- Then update policies with correct column name below:

DROP POLICY IF EXISTS "Sellers can view own wallet" ON wallets;
CREATE POLICY "Sellers can view own wallet" ON wallets
  FOR SELECT USING (seller_id IN (
    SELECT id FROM sellers WHERE [YOUR_AUTH_COLUMN] = auth.uid()
  ));

DROP POLICY IF EXISTS "Sellers can view own transactions" ON transactions;
CREATE POLICY "Sellers can view own transactions" ON transactions
  FOR SELECT USING (seller_id IN (
    SELECT id FROM sellers WHERE [YOUR_AUTH_COLUMN] = auth.uid()
  ));

DROP POLICY IF EXISTS "Admins can view all earnings" ON admin_earnings;
CREATE POLICY "Admins can view all earnings" ON admin_earnings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM buyers 
      WHERE [YOUR_AUTH_COLUMN] = auth.uid() AND user_type = 'Admin'
    )
  );

DROP POLICY IF EXISTS "Sellers can manage own withdrawal requests" ON withdrawal_requests;
CREATE POLICY "Sellers can manage own withdrawal requests" ON withdrawal_requests
  FOR ALL USING (seller_id IN (
    SELECT id FROM sellers WHERE [YOUR_AUTH_COLUMN] = auth.uid()
  ));
*/

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify the migration
DO $$
BEGIN
  RAISE NOTICE '✅ Database migration completed successfully!';
  RAISE NOTICE '📋 Tables created/updated:';
  RAISE NOTICE '   - orders (added payment & shipment columns)';
  RAISE NOTICE '   - wallets (created/verified)';
  RAISE NOTICE '   - transactions (created/verified)';
  RAISE NOTICE '   - admin_earnings (created)';
  RAISE NOTICE '   - withdrawal_requests (created)';
  RAISE NOTICE '⏰ Triggers for updated_at created';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  NOTE: RLS policies are commented out';
  RAISE NOTICE '   Payment & delivery integration will work without them';
  RAISE NOTICE '   Enable them later if needed for production security';
END $$;
