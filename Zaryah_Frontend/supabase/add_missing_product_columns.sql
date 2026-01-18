-- Migration to add missing product columns
-- Run this in your Supabase SQL Editor to fix the "care_instructions column not found" error

-- Add MRP (Maximum Retail Price)
ALTER TABLE products ADD COLUMN IF NOT EXISTS mrp DECIMAL(10, 2);

-- Add material
ALTER TABLE products ADD COLUMN IF NOT EXISTS material VARCHAR(255);

-- Add care instructions
ALTER TABLE products ADD COLUMN IF NOT EXISTS care_instructions TEXT;

-- Add size options
ALTER TABLE products ADD COLUMN IF NOT EXISTS size_options TEXT[];

-- Add return and exchange policies
ALTER TABLE products ADD COLUMN IF NOT EXISTS return_available BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS exchange_available BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS return_days INTEGER DEFAULT 0;

-- Add COD availability
ALTER TABLE products ADD COLUMN IF NOT EXISTS cod_available BOOLEAN DEFAULT true;

-- Add legal disclaimer
ALTER TABLE products ADD COLUMN IF NOT EXISTS legal_disclaimer TEXT;

-- Add comment to document the changes
COMMENT ON COLUMN products.mrp IS 'Maximum Retail Price';
COMMENT ON COLUMN products.material IS 'Product material information';
COMMENT ON COLUMN products.care_instructions IS 'Care and maintenance instructions';
COMMENT ON COLUMN products.size_options IS 'Available size options as array';
COMMENT ON COLUMN products.return_available IS 'Whether product is eligible for returns';
COMMENT ON COLUMN products.exchange_available IS 'Whether product is eligible for exchange';
COMMENT ON COLUMN products.return_days IS 'Number of days for return/exchange window';
COMMENT ON COLUMN products.cod_available IS 'Whether Cash on Delivery is available';
COMMENT ON COLUMN products.legal_disclaimer IS 'Legal disclaimer text for the product';
