-- Migration: Add image_url column to seller_sections table
-- This column stores the URL to the section's cover image
-- If no image is provided, the UI will use a default fallback image

ALTER TABLE seller_sections 
ADD COLUMN image_url TEXT DEFAULT NULL;

-- Create an index on seller_id for faster queries if it doesn't exist
-- (This is optional but recommended for performance)
CREATE INDEX IF NOT EXISTS seller_sections_seller_id_idx 
ON seller_sections(seller_id);
