-- Migration: Add exchange_available column to products table
-- This allows sellers to specify whether exchanges are available for products

ALTER TABLE products ADD COLUMN IF NOT EXISTS exchange_available BOOLEAN DEFAULT false;

-- Update comment for clarity
COMMENT ON COLUMN products.exchange_available IS 'Indicates whether product exchanges are allowed';
