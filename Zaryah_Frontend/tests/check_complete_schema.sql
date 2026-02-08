-- Run each query separately and share results

-- QUERY 1: Show all columns in key tables
SELECT 'ORDERS' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
ORDER BY ordinal_position;

-- QUERY 2: Show sellers (check addresses)
SELECT * FROM sellers;

-- QUERY 3: Show latest 5 orders
SELECT * FROM orders ORDER BY created_at DESC LIMIT 5;

-- QUERY 4: Show wallets
SELECT * FROM wallets;

-- QUERY 5: Check if wallet functions exist
SELECT proname FROM pg_proc 
WHERE proname IN ('credit_seller_wallet_pending', 'release_seller_wallet_funds', 'debit_seller_wallet', 'get_seller_wallet_summary');
