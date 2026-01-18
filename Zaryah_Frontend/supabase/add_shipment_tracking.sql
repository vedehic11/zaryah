-- Add shipment tracking fields to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipment_id VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS awb_code VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_name VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipment_status VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipment_created_at TIMESTAMP WITH TIME ZONE;

-- Create index on AWB code for quick lookups
CREATE INDEX IF NOT EXISTS idx_orders_awb_code ON orders(awb_code);

-- Create index on shipment_id for webhook lookups
CREATE INDEX IF NOT EXISTS idx_orders_shipment_id ON orders(shipment_id);

-- Add comment
COMMENT ON COLUMN orders.shipment_id IS 'Shiprocket shipment ID';
COMMENT ON COLUMN orders.awb_code IS 'Air Waybill number from courier';
COMMENT ON COLUMN orders.courier_name IS 'Courier company name';
COMMENT ON COLUMN orders.tracking_url IS 'URL to track shipment';
COMMENT ON COLUMN orders.shipment_status IS 'Current shipment status from Shiprocket';
