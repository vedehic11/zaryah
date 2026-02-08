-- SQL Function: Credit Seller Wallet with Pending Status
-- This function is called when payment is received but order not yet delivered
-- Funds are marked as 'pending' until delivery confirmation

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

  RAISE NOTICE 'Credited ₹% to seller % wallet as PENDING (order %)', p_amount, p_seller_id, p_order_id;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION credit_seller_wallet_pending(UUID, UUID, DECIMAL, TEXT) TO authenticated;
