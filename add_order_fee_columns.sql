-- Add delivery_fee and service_charge columns to orders table
-- This supports the new revenue model where:
-- - Admin gets 100% of delivery fees
-- - Admin gets 2.5% commission from seller (product amount)
-- - Admin gets 2.5% service charge from buyer (added to their bill)
-- - Seller gets 97.5% of product amount

-- Add delivery_fee column (if not exists)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10, 2) DEFAULT 0;

-- Add service_charge column (if not exists)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS service_charge DECIMAL(10, 2) DEFAULT 0;

-- Add comments to clarify column purposes
COMMENT ON COLUMN orders.delivery_fee IS 'Delivery charge calculated based on weight and distance (Shiprocket API). 100% goes to admin.';
COMMENT ON COLUMN orders.service_charge IS 'Platform service charge (2.5% of product amount) paid by buyer. Goes to admin.';

-- Update existing orders to have 0 for these fields if they are NULL
UPDATE orders 
SET delivery_fee = 0 
WHERE delivery_fee IS NULL;

UPDATE orders 
SET service_charge = 0 
WHERE service_charge IS NULL;

-- Optional: Add delivery_fee to admin_earnings table for better tracking
ALTER TABLE admin_earnings
ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10, 2) DEFAULT 0;

COMMENT ON COLUMN admin_earnings.delivery_fee IS 'Delivery fee component of admin earnings from this order';
