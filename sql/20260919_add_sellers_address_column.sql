-- Migration: Add 'address' column to sellers for backward compatibility
BEGIN;

ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS address text;

-- Copy existing business_address into new address column for existing rows
UPDATE public.sellers
SET address = business_address
WHERE (address IS NULL OR address = '');

COMMIT;
