-- SQL Function: Release Seller Wallet Funds on Delivery
-- This function moves funds from 'pending' status to 'completed' status
-- when an order is delivered, making the funds available to the seller

CREATE OR REPLACE FUNCTION release_seller_wallet_funds(p_order_id UUID)
RETURNS void AS $$
DECLARE
  v_seller_id UUID;
  v_pending_amount DECIMAL(10,2);
BEGIN
  -- Get seller ID and pending amount from order
  SELECT seller_id, seller_amount INTO v_seller_id, v_pending_amount
  FROM orders
  WHERE id = p_order_id;

  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'Order not found or has no seller_id';
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

  -- Update seller's wallet balance
  UPDATE wallets
  SET 
    available_balance = COALESCE(available_balance, 0) + v_pending_amount,
    pending_balance = COALESCE(pending_balance, 0) - v_pending_amount,
    updated_at = NOW()
  WHERE seller_id = v_seller_id;

  -- If wallet doesn't exist, create it with the released amount
  INSERT INTO wallets (seller_id, available_balance, pending_balance)
  VALUES (v_seller_id, v_pending_amount, 0)
  ON CONFLICT (seller_id) DO NOTHING;

  -- Log the release
  RAISE NOTICE 'Released ₹% for seller % (order %)', v_pending_amount, v_seller_id, p_order_id;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION release_seller_wallet_funds(UUID) TO authenticated;

-- Example usage:
-- SELECT release_seller_wallet_funds('order-uuid-here');
