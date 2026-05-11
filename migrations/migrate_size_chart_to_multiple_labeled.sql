-- Migrate size chart from single URL to multiple labeled charts with multiple images per chart (JSONB array)
-- This allows storing multiple charts like "Size Chart", "Fabric Chart", etc.
-- Each chart can have multiple images to show different angles or variations.

ALTER TABLE products
DROP COLUMN IF EXISTS size_chart_url;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS size_charts JSONB DEFAULT '[]'::jsonb;

-- Comment explaining the new structure
-- Structure: [{"label": "Size Chart", "urls": ["url1", "url2", ...]}, {"label": "Fabric Chart", "urls": ["url1", "url2", ...]}]
-- Each chart object contains:
--   - label: String (chart name like "Size Chart", "Fabric Chart", "Care Instructions", etc.)
--   - urls: Array of image URLs (supports multiple images per chart for different angles/variations)
COMMENT ON COLUMN products.size_charts IS 'JSONB array of labeled reference charts with multiple images. Each chart has label (string) and urls (array of image URLs)';
