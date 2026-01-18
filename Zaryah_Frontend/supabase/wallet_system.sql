-- ================================================
-- WALLET & COMMISSION SYSTEM FOR ZARYAH MARKETPLACE
-- ================================================
-- This migration adds wallet functionality with 5% admin commission
-- Supports escrow, pending/available balance, and seller payouts

-- ================================================
-- 1. WALLETS TABLE
-- ================================================
-- Stores seller wallet balances
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  available_balance DECIMAL(10, 2) DEFAULT 0.00 NOT NULL CHECK (available_balance >= 0),
  pending_balance DECIMAL(10, 2) DEFAULT 0.00 NOT NULL CHECK (pending_balance >= 0),
  total_earned DECIMAL(10, 2) DEFAULT 0.00 NOT NULL,
  total_withdrawn DECIMAL(10, 2) DEFAULT 0.00 NOT NULL,
  last_withdrawal_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(seller_id)
);

-- ================================================
-- 2. TRANSACTIONS TABLE
-- ================================================
-- Tracks all wallet transactions (credits, debits, commission deductions)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'credit_pending',      -- Order payment received (pending delivery)
    'credit_available',    -- Balance became available after delivery
    'debit_withdrawal',    -- Seller withdrew funds
    'debit_refund',        -- Refund issued to buyer
    'commission_deducted', -- Admin commission taken
    'reversal_rto',        -- Order cancelled/RTO
    'adjustment'           -- Manual admin adjustment
  )),
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_transactions_seller ON transactions(seller_id);
CREATE INDEX idx_transactions_order ON transactions(order_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);

-- ================================================
-- 3. ADMIN EARNINGS TABLE
-- ================================================
-- Tracks platform commission earnings (5% per order)
CREATE TABLE IF NOT EXISTS admin_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  order_amount DECIMAL(10, 2) NOT NULL,
  commission_rate DECIMAL(5, 2) DEFAULT 5.00 NOT NULL,
  commission_amount DECIMAL(10, 2) NOT NULL,
  seller_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'earned' CHECK (status IN ('earned', 'reversed')),
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  reversed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id)
);

CREATE INDEX idx_admin_earnings_seller ON admin_earnings(seller_id);
CREATE INDEX idx_admin_earnings_earned_at ON admin_earnings(earned_at DESC);

-- ================================================
-- 4. WITHDRAWAL REQUESTS TABLE
-- ================================================
-- Manages seller payout requests
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 500.00), -- Minimum ₹500
  bank_account_number VARCHAR(20) NOT NULL,
  ifsc_code VARCHAR(11) NOT NULL,
  account_holder_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Awaiting admin approval
    'approved',     -- Admin approved, processing
    'processing',   -- Payment in progress
    'completed',    -- Money transferred
    'failed',       -- Transfer failed
    'rejected'      -- Admin rejected
  )),
  razorpay_payout_id VARCHAR(255),
  transaction_id UUID REFERENCES transactions(id),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES users(id),
  failure_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_withdrawal_requests_seller ON withdrawal_requests(seller_id);
CREATE INDEX idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX idx_withdrawal_requests_requested ON withdrawal_requests(requested_at DESC);

-- ================================================
-- 5. ADD PAYMENT TRACKING TO ORDERS TABLE
-- ================================================
-- Add columns to track payment and wallet integration
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending' 
  CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10, 2) DEFAULT 0.00;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_amount DECIMAL(10, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS wallet_credited BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order ON orders(razorpay_order_id);

-- ================================================
-- 6. TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_withdrawal_requests_updated_at BEFORE UPDATE ON withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- 7. FUNCTION TO CALCULATE COMMISSION
-- ================================================
CREATE OR REPLACE FUNCTION calculate_commission(order_total DECIMAL, rate DECIMAL DEFAULT 5.00)
RETURNS TABLE(commission DECIMAL, seller_amount DECIMAL) AS $$
BEGIN
  RETURN QUERY SELECT 
    ROUND(order_total * rate / 100, 2) as commission,
    ROUND(order_total - (order_total * rate / 100), 2) as seller_amount;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- 8. FUNCTION TO CREDIT SELLER WALLET (PENDING)
-- ================================================
-- Called when order is paid, credits to pending_balance
CREATE OR REPLACE FUNCTION credit_seller_wallet_pending(
  p_seller_id UUID,
  p_order_id UUID,
  p_amount DECIMAL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
BEGIN
  -- Create wallet if doesn't exist
  INSERT INTO wallets (seller_id)
  VALUES (p_seller_id)
  ON CONFLICT (seller_id) DO NOTHING;

  -- Add to pending balance
  UPDATE wallets
  SET pending_balance = pending_balance + p_amount,
      updated_at = NOW()
  WHERE seller_id = p_seller_id;

  -- Create transaction record
  INSERT INTO transactions (seller_id, order_id, amount, type, description, status)
  VALUES (p_seller_id, p_order_id, p_amount, 'credit_pending', p_description, 'completed')
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- 9. FUNCTION TO MOVE PENDING TO AVAILABLE
-- ================================================
-- Called when order is delivered successfully
CREATE OR REPLACE FUNCTION move_pending_to_available(
  p_seller_id UUID,
  p_order_id UUID,
  p_amount DECIMAL
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
BEGIN
  -- Move from pending to available
  UPDATE wallets
  SET pending_balance = pending_balance - p_amount,
      available_balance = available_balance + p_amount,
      total_earned = total_earned + p_amount,
      updated_at = NOW()
  WHERE seller_id = p_seller_id
    AND pending_balance >= p_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient pending balance for seller %', p_seller_id;
  END IF;

  -- Create transaction record
  INSERT INTO transactions (seller_id, order_id, amount, type, description, status)
  VALUES (p_seller_id, p_order_id, p_amount, 'credit_available', 
          'Order delivered - funds now available', 'completed')
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- 10. FUNCTION TO PROCESS WITHDRAWAL
-- ================================================
CREATE OR REPLACE FUNCTION process_withdrawal(
  p_withdrawal_id UUID,
  p_transaction_id UUID,
  p_razorpay_payout_id VARCHAR DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_withdrawal withdrawal_requests%ROWTYPE;
BEGIN
  -- Get withdrawal details
  SELECT * INTO v_withdrawal FROM withdrawal_requests WHERE id = p_withdrawal_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request not found';
  END IF;

  -- Deduct from available balance
  UPDATE wallets
  SET available_balance = available_balance - v_withdrawal.amount,
      total_withdrawn = total_withdrawn + v_withdrawal.amount,
      last_withdrawal_at = NOW(),
      updated_at = NOW()
  WHERE seller_id = v_withdrawal.seller_id
    AND available_balance >= v_withdrawal.amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient available balance';
  END IF;

  -- Create debit transaction
  INSERT INTO transactions (seller_id, amount, type, description, status)
  VALUES (v_withdrawal.seller_id, v_withdrawal.amount, 'debit_withdrawal',
          'Withdrawal to bank account', 'completed');

  -- Update withdrawal status
  UPDATE withdrawal_requests
  SET status = 'completed',
      transaction_id = p_transaction_id,
      razorpay_payout_id = p_razorpay_payout_id,
      processed_at = NOW()
  WHERE id = p_withdrawal_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- 11. RLS POLICIES (Row Level Security)
-- ================================================
-- Enable RLS on all tables
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Sellers can view their own wallet
CREATE POLICY sellers_view_own_wallet ON wallets
  FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

-- Sellers can view their own transactions
CREATE POLICY sellers_view_own_transactions ON transactions
  FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

-- Sellers can create withdrawal requests
CREATE POLICY sellers_create_withdrawals ON withdrawal_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (seller_id = auth.uid());

-- Sellers can view their own withdrawal requests
CREATE POLICY sellers_view_own_withdrawals ON withdrawal_requests
  FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

-- Admins can view everything
CREATE POLICY admins_view_all_wallets ON wallets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.supabase_auth_id = auth.uid() 
      AND users.user_type = 'Admin'
    )
  );

CREATE POLICY admins_view_all_transactions ON transactions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.supabase_auth_id = auth.uid() 
      AND users.user_type = 'Admin'
    )
  );

CREATE POLICY admins_view_all_earnings ON admin_earnings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.supabase_auth_id = auth.uid() 
      AND users.user_type = 'Admin'
    )
  );

CREATE POLICY admins_manage_withdrawals ON withdrawal_requests
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.supabase_auth_id = auth.uid() 
      AND users.user_type = 'Admin'
    )
  );

-- ================================================
-- 12. INITIAL DATA / SEED
-- ================================================
-- Create wallets for all existing sellers
INSERT INTO wallets (seller_id)
SELECT id FROM sellers
ON CONFLICT (seller_id) DO NOTHING;

-- ================================================
-- END OF MIGRATION
-- ================================================
-- Run this migration to add complete wallet system
-- Run: psql -U postgres -d your_db < wallet_system.sql
-- Or copy into Supabase SQL Editor
