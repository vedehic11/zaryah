-- Update seller address with state and pincode for Shiprocket
-- This is the correct seller ID from the sellers table

UPDATE sellers 
SET 
  state = 'Maharashtra',
  pincode = '422001',
  city = 'Mumbai',
  business_address = '14, Shivsagar Society, Shingada Talav, Gurudwara Road'
WHERE id = '4bf172a2-1a05-486a-84a9-b162d3c70df3';

-- Verify the update
SELECT 
  id, 
  full_name,
  business_name, 
  business_address, 
  city, 
  state, 
  pincode,
  primary_mobile
FROM sellers 
WHERE id = '4bf172a2-1a05-486a-84a9-b162d3c70df3';
