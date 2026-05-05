-- Seller-wide Cash on Delivery toggle
-- Run in Supabase SQL editor

alter table if exists public.sellers
  add column if not exists allow_cod boolean default true;

update public.sellers
set allow_cod = true
where allow_cod is null;