-- remove_user_84914.sql
-- Cleanup checklist and optional safe delete script for user
-- UUID: 84914af3-df16-4997-814b-990c2525f420
-- WARNING: Run the SELECTs first and back up rows you may need.

-- === SELECT checks (run these first) ===
SELECT * FROM users WHERE id = '84914af3-df16-4997-814b-990c2525f420';
SELECT * FROM buyers WHERE id = '84914af3-df16-4997-814b-990c2525f420';
SELECT * FROM sellers WHERE id = '84914af3-df16-4997-814b-990c2525f420';
SELECT * FROM addresses WHERE user_id = '84914af3-df16-4997-814b-990c2525f420';
SELECT * FROM carts WHERE buyer_id = '84914af3-df16-4997-814b-990c2525f420';
SELECT * FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE buyer_id = '84914af3-df16-4997-814b-990c2525f420');
SELECT * FROM wishlist WHERE user_id = '84914af3-df16-4997-814b-990c2525f420';
SELECT * FROM orders WHERE buyer_id = '84914af3-df16-4997-814b-990c2525f420' OR seller_id = '84914af3-df16-4997-814b-990c2525f420';
SELECT * FROM products WHERE seller_id = '84914af3-df16-4997-814b-990c2525f420';
SELECT * FROM seller_sections WHERE seller_id = '84914af3-df16-4997-814b-990c2525f420';
SELECT * FROM wallets WHERE seller_id = '84914af3-df16-4997-814b-990c2525f420';
SELECT * FROM transactions WHERE seller_id = '84914af3-df16-4997-814b-990c2525f420' OR created_by = '84914af3-df16-4997-814b-990c2525f420';
SELECT * FROM withdrawal_requests WHERE seller_id = '84914af3-df16-4997-814b-990c2525f420';
SELECT * FROM product_ratings WHERE user_id = '84914af3-df16-4997-814b-990c2525f420';
SELECT * FROM notifications WHERE user_id = '84914af3-df16-4997-814b-990c2525f420';
SELECT * FROM email_verifications WHERE user_id = '84914af3-df16-4997-814b-990c2525f420';
SELECT * FROM support_tickets WHERE user_id = '84914af3-df16-4997-814b-990c2525f420' OR seller_id = '84914af3-df16-4997-814b-990c2525f420';
-- NOTE: `uploads` table not found in provided `db.sql` schema. Run these only if your DB has an `uploads` table.
-- SELECT * FROM uploads WHERE user_id = '84914af3-df16-4997-814b-990c2525f420';

-- === Optional: backup example (create local backup tables) ===
-- CREATE TABLE backup_users_84914 AS SELECT * FROM users WHERE id = '84914af3-df16-4997-814b-990c2525f420';
-- CREATE TABLE backup_products_84914 AS SELECT * FROM products WHERE seller_id = '84914af3-df16-4997-814b-990c2525f420';

-- === Optional safe delete script ===
-- Run only after verifying SELECTs and backing up. Execute inside a transaction.
BEGIN;

-- dependents first
DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE buyer_id = '84914af3-df16-4997-814b-990c2525f420');
DELETE FROM carts WHERE buyer_id = '84914af3-df16-4997-814b-990c2525f420';
DELETE FROM wishlist WHERE user_id = '84914af3-df16-4997-814b-990c2525f420';
DELETE FROM addresses WHERE user_id = '84914af3-df16-4997-814b-990c2525f420';
DELETE FROM product_ratings WHERE user_id = '84914af3-df16-4997-814b-990c2525f420';
DELETE FROM notifications WHERE user_id = '84914af3-df16-4997-814b-990c2525f420';
DELETE FROM email_verifications WHERE user_id = '84914af3-df16-4997-814b-990c2525f420';
DELETE FROM support_tickets WHERE user_id = '84914af3-df16-4997-814b-990c2525f420' OR seller_id = '84914af3-df16-4997-814b-990c2525f420';
-- NOTE: `uploads` table not found in provided `db.sql` schema. Run these only if your DB has an `uploads` table.
-- DELETE FROM uploads WHERE user_id = '84914af3-df16-4997-814b-990c2525f420';
DELETE FROM withdrawal_requests WHERE seller_id = '84914af3-df16-4997-814b-990c2525f420';
DELETE FROM transactions WHERE seller_id = '84914af3-df16-4997-814b-990c2525f420' OR created_by = '84914af3-df16-4997-814b-990c2525f420';
DELETE FROM wallets WHERE seller_id = '84914af3-df16-4997-814b-990c2525f420';
DELETE FROM orders WHERE buyer_id = '84914af3-df16-4997-814b-990c2525f420' OR seller_id = '84914af3-df16-4997-814b-990c2525f420';
DELETE FROM products WHERE seller_id = '84914af3-df16-4997-814b-990c2525f420';
DELETE FROM seller_sections WHERE seller_id = '84914af3-df16-4997-814b-990c2525f420';

-- remove role-specific rows
DELETE FROM buyers WHERE id = '84914af3-df16-4997-814b-990c2525f420';
DELETE FROM sellers WHERE id = '84914af3-df16-4997-814b-990c2525f420';

-- finally remove from users
DELETE FROM users WHERE id = '84914af3-df16-4997-814b-990c2525f420';

COMMIT;

-- === Supabase Auth note ===
-- If this project uses Supabase Auth, remove the auth user via the Admin API or the Supabase Dashboard:
-- Example (Node):
-- const { data, error } = await supabase.auth.admin.deleteUser('84914af3-df16-4997-814b-990c2525f420');
-- Do NOT attempt to directly delete rows from the auth schema via SQL unless you know the consequences.

-- End of file
