-- Remove minimum withdrawal amount check and allow any positive amount
-- Run this in Supabase SQL Editor

ALTER TABLE public.withdrawal_requests
DROP CONSTRAINT IF EXISTS withdrawal_requests_amount_check;

ALTER TABLE public.withdrawal_requests
ADD CONSTRAINT withdrawal_requests_amount_check
CHECK (amount > 0);
