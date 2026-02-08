-- TEST SCRIPT: Verify Payment & Delivery Integration
-- Run this AFTER completing the migration and function setup

-- ============================================================================
-- 1. VERIFY TABLES EXIST
-- ============================================================================

DO $$
DECLARE
  v_tables TEXT[] := ARRAY['orders', 'wallets', 'transactions', 'admin_earnings', 'withdrawal_requests', 'sellers', 'buyers'];
  v_table TEXT;
  v_exists BOOLEAN;
BEGIN
  RAISE NOTICE '🔍 Checking if all required tables exist...';
  RAISE NOTICE '';
  
  FOREACH v_table IN ARRAY v_tables
  LOOP
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = v_table
    ) INTO v_exists;
    
    IF v_exists THEN
      RAISE NOTICE '✅ Table "%" exists', v_table;
    ELSE
      RAISE NOTICE '❌ Table "%" is MISSING!', v_table;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 2. VERIFY ORDERS TABLE COLUMNS
-- ============================================================================

DO $$
DECLARE
  v_columns TEXT[] := ARRAY[
    'razorpay_order_id', 'razorpay_payment_id', 'payment_status',
    'commission_amount', 'seller_amount', 'shipment_id', 'awb_code',
    'tracking_url', 'courier_name', 'shipment_status', 'notes'
  ];
  v_column TEXT;
  v_exists BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Checking orders table columns...';
  RAISE NOTICE '';
  
  FOREACH v_column IN ARRAY v_columns
  LOOP
    SELECT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_name = 'orders' 
      AND column_name = v_column
    ) INTO v_exists;
    
    IF v_exists THEN
      RAISE NOTICE '✅ Column orders.% exists', v_column;
    ELSE
      RAISE NOTICE '❌ Column orders.% is MISSING!', v_column;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 3. VERIFY WALLET FUNCTIONS EXIST
-- ============================================================================

DO $$
DECLARE
  v_functions TEXT[] := ARRAY[
    'credit_seller_wallet_pending',
    'release_seller_wallet_funds',
    'debit_seller_wallet',
    'get_seller_wallet_summary'
  ];
  v_function TEXT;
  v_exists BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Checking if wallet functions exist...';
  RAISE NOTICE '';
  
  FOREACH v_function IN ARRAY v_functions
  LOOP
    SELECT EXISTS (
      SELECT FROM pg_proc 
      WHERE proname = v_function
    ) INTO v_exists;
    
    IF v_exists THEN
      RAISE NOTICE '✅ Function %() exists', v_function;
    ELSE
      RAISE NOTICE '❌ Function %() is MISSING!', v_function;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 4. CHECK WALLETS TABLE STRUCTURE
-- ============================================================================

SELECT 
  '🔍 Wallets table columns:' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'wallets'
ORDER BY ordinal_position;

-- ============================================================================
-- 5. CHECK TRANSACTIONS TABLE STRUCTURE
-- ============================================================================

SELECT 
  '🔍 Transactions table columns:' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'transactions'
ORDER BY ordinal_position;

-- ============================================================================
-- 6. CHECK INDEXES
-- ============================================================================

SELECT 
  '🔍 Database indexes:' as info,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('orders', 'wallets', 'transactions', 'admin_earnings')
ORDER BY tablename, indexname;

-- ============================================================================
-- 7. FINAL SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '🎉 VERIFICATION COMPLETE';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Review the output above:';
  RAISE NOTICE '   - All ✅ marks = Everything is set up correctly';
  RAISE NOTICE '   - Any ❌ marks = Run the missing migration/function script';
  RAISE NOTICE '';
  RAISE NOTICE '📚 Setup Scripts (in order):';
  RAISE NOTICE '   1. database/01_migration_payment_delivery.sql';
  RAISE NOTICE '   2. database/02_wallet_functions.sql';
  RAISE NOTICE '';
END $$;
