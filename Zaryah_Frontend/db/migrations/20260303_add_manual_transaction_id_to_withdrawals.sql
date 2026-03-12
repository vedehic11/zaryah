-- Add manual transaction reference for admin-processed seller withdrawals
-- Run this in Supabase SQL editor before using manual payout approval flow

ALTER TABLE public.withdrawal_requests
ADD COLUMN IF NOT EXISTS manual_transaction_id TEXT;