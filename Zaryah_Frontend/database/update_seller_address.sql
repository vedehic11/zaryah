-- Update seller pickup address for Shiprocket
-- Run this in Supabase SQL Editor

UPDATE sellers 
SET 
  state = 'Maharashtra',
  pincode = '422001',
  city = 'Mumbai',
  business_address = COALESCE(business_address, '14, Shivsagar Society, Shingada Talav, Gurudwara Road')
WHERE id = '74ed6a08-400e-41ac-b741-4c104b6040da';

-- Verify the update
SELECT id, business_name, business_address, city, state, pincode
FROM sellers 
WHERE id = '74ed6a08-400e-41ac-b741-4c104b6040da';
