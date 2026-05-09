-- Migrate size chart from single URL to multiple labeled charts (JSONB array)
-- This allows storing multiple charts like "Size Chart", "Fabric Chart", etc.

ALTER TABLE products
DROP COLUMN IF EXISTS size_chart_url;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS size_charts JSONB DEFAULT '[]'::jsonb;

-- Comment explaining the new structure
COMMENT ON COLUMN products.size_charts IS 'Array of chart objects with structure: [{"label": "Size Chart", "url": "..."}, {"label": "Fabric Chart", "url": "..."}]';
