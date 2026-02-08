-- Wallet Management Functions for Payment & Delivery Integration
-- Run this AFTER running 01_migration_payment_delivery.sql

-- ============================================================================
-- FUNCTION 1: Credit Seller Wallet with Pending Status
-- ============================================================================
-- Called when payment is received but order not yet delivered
-- Funds are marked as 'pending' until delivery confirmation

DROP FUNCTION IF EXISTS credit_seller_wallet_pending(UUID, UUID, DECIMAL, TEXT);

CREATE OR REPLACE FUNCTION credit_seller_wallet_pending(
  p_seller_id UUID,
  p_order_id UUID,
  p_amount DECIMAL(10,2),
  p_description TEXT DEFAULT 'Payment received - pending delivery'
)
RETURNS void AS $$
BEGIN
  -- Ensure wallet exists for seller
  INSERT INTO wallets (seller_id, available_balance, pending_balance, total_earned)
  VALUES (p_seller_id, 0, 0, 0)
  ON CONFLICT (seller_id) DO NOTHING;

  -- Add to pending balance
  UPDATE wallets
  SET 
    pending_balance = COALESCE(pending_balance, 0) + p_amount,
    total_earned = COALESCE(total_earned, 0) + p_amount,
    updated_at = NOW()
  WHERE seller_id = p_seller_id;

  -- Create transaction record with pending status
  INSERT INTO transactions (
    seller_id,
    order_id,
    type,
    amount,
    status,
    description,
    created_at
  ) VALUES (
    p_seller_id,
    p_order_id,
    'credit',
    p_amount,
    'pending',
    p_description,
    NOW()
  );

  RAISE NOTICE '✅ Credited ₹% to seller % wallet as PENDING (order %)', p_amount, p_seller_id, p_order_id;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION 2: Release Seller Wallet Funds on Delivery
-- ============================================================================
-- Moves funds from 'pending' status to 'completed' status
-- when an order is delivered, making the funds available to the seller

DROP FUNCTION IF EXISTS release_seller_wallet_funds(UUID);

CREATE OR REPLACE FUNCTION release_seller_wallet_funds(p_order_id UUID)
RETURNS void AS $$
DECLARE
  v_seller_id UUID;
  v_pending_amount DECIMAL(10,2);
  v_rows_updated INTEGER;
BEGIN
  -- Get seller ID and pending amount from order
  SELECT seller_id, seller_amount INTO v_seller_id, v_pending_amount
  FROM orders
  WHERE id = p_order_id;

  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'Order not found or has no seller_id';
  END IF;
  
  IF v_pending_amount IS NULL OR v_pending_amount <= 0 THEN
    RAISE WARNING 'No seller amount to release for order %', p_order_id;
    RETURN;
  END IF;

  -- Update transactions from pending to completed
  UPDATE transactions
  SET 
    status = 'completed',
    updated_at = NOW()
  WHERE 
    order_id = p_order_id 
    AND seller_id = v_seller_id
    AND status = 'pending'
    AND type = 'credit';
  
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  -- Update seller's wallet balance (move from pending to available)
  UPDATE wallets
  SET 
    available_balance = COALESCE(available_balance, 0) + v_pending_amount,
    pending_balance = GREATEST(COALESCE(pending_balance, 0) - v_pending_amount, 0),
    updated_at = NOW()
  WHERE seller_id = v_seller_id;

  -- If wallet doesn't exist, create it with the released amount
  INSERT INTO wallets (seller_id, available_balance, pending_balance, total_earned)
  VALUES (v_seller_id, v_pending_amount, 0, v_pending_amount)
  ON CONFLICT (seller_id) DO NOTHING;

  IF v_rows_updated > 0 THEN
    RAISE NOTICE '✅ Released ₹% for seller % (order %) - % transactions updated', 
      v_pending_amount, v_seller_id, p_order_id, v_rows_updated;
  ELSE
    RAISE WARNING '⚠️ No pending transactions found for order %, but wallet updated', p_order_id;
  END IF;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION 3: Debit Seller Wallet (for withdrawals)
-- ============================================================================

DROP FUNCTION IF EXISTS debit_seller_wallet(UUID, DECIMAL, TEXT);

CREATE OR REPLACE FUNCTION debit_seller_wallet(
  p_seller_id UUID,
  p_amount DECIMAL(10,2),
  p_description TEXT DEFAULT 'Withdrawal'
)
RETURNS void AS $$
DECLARE
  v_available_balance DECIMAL(10,2);
BEGIN
  -- Check available balance
  SELECT available_balance INTO v_available_balance
  FROM wallets
  WHERE seller_id = p_seller_id;
  
  IF v_available_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for seller %', p_seller_id;
  END IF;
  
  IF v_available_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Available: ₹%, Requested: ₹%', v_available_balance, p_amount;
  END IF;

  -- Deduct from available balance
  UPDATE wallets
  SET 
    available_balance = available_balance - p_amount,
    total_withdrawn = COALESCE(total_withdrawn, 0) + p_amount,
    updated_at = NOW()
  WHERE seller_id = p_seller_id;

  -- Create debit transaction
  INSERT INTO transactions (
    seller_id,
    type,
    amount,
    status,
    description,
    created_at
  ) VALUES (
    p_seller_id,
    'debit',
    p_amount,
    'completed',
    p_description,
    NOW()
  );

  RAISE NOTICE '✅ Debited ₹% from seller % wallet', p_amount, p_seller_id;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION 4: Get Seller Wallet Summary
-- ============================================================================

DROP FUNCTION IF EXISTS get_seller_wallet_summary(UUID);

CREATE OR REPLACE FUNCTION get_seller_wallet_summary(p_seller_id UUID)
RETURNS TABLE(
  available_balance DECIMAL(10,2),
  pending_balance DECIMAL(10,2),
  total_earned DECIMAL(10,2),
  total_withdrawn DECIMAL(10,2),
  pending_orders_count BIGINT,
  completed_orders_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.available_balance,
    w.pending_balance,
    w.total_earned,
    w.total_withdrawn,
    COUNT(DISTINCT CASE WHEN t.status = 'pending' THEN t.order_id END) as pending_orders_count,
    COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.order_id END) as completed_orders_count
  FROM wallets w
  LEFT JOIN transactions t ON t.seller_id = w.seller_id AND t.type = 'credit'
  WHERE w.seller_id = p_seller_id
  GROUP BY w.available_balance, w.pending_balance, w.total_earned, w.total_withdrawn;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION credit_seller_wallet_pending(UUID, UUID, DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION release_seller_wallet_funds(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION debit_seller_wallet(UUID, DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_seller_wallet_summary(UUID) TO authenticated;

-- ============================================================================
-- VERIFICATION & EXAMPLES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ All wallet functions created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Available Functions:';
  RAISE NOTICE '   1. credit_seller_wallet_pending() - Credit pending balance on payment';
  RAISE NOTICE '   2. release_seller_wallet_funds() - Release pending funds on delivery';
  RAISE NOTICE '   3. debit_seller_wallet() - Debit for withdrawals';
  RAISE NOTICE '   4. get_seller_wallet_summary() - Get wallet overview';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 Example Usage:';
  RAISE NOTICE '   SELECT credit_seller_wallet_pending(''seller-uuid'', ''order-uuid'', 95.00, ''Payment received'');';
  RAISE NOTICE '   SELECT release_seller_wallet_funds(''order-uuid'');';
  RAISE NOTICE '   SELECT * FROM get_seller_wallet_summary(''seller-uuid'');';
END $$;
