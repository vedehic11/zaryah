ALTER TABLE orders
ADD COLUMN IF NOT EXISTS gift_packaging_fee NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS platform_fee NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS seller_amount NUMERIC(10, 2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_orders_gift_packaging_fee ON orders(gift_packaging_fee) WHERE gift_packaging_fee > 0;
CREATE INDEX IF NOT EXISTS idx_orders_platform_fee ON orders(platform_fee) WHERE platform_fee > 0;
CREATE INDEX IF NOT EXISTS idx_orders_commission_amount ON orders(commission_amount) WHERE commission_amount > 0;
CREATE INDEX IF NOT EXISTS idx_orders_seller_amount ON orders(seller_amount);
