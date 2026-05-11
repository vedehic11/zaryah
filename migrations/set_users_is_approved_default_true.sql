-- Set users.is_approved to true by default so newly created accounts are approved automatically.
-- This keeps seller creation aligned with the app-level default and preserves buyer auto-approval.

ALTER TABLE users
ALTER COLUMN is_approved SET DEFAULT true;
