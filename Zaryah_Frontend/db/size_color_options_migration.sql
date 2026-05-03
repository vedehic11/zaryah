-- Add size pricing + color options for products
alter table public.products
  add column if not exists size_price_options jsonb,
  add column if not exists color_options jsonb;

-- Persist selected size/color and unit price in cart items
alter table public.cart_items
  add column if not exists selected_size text,
  add column if not exists selected_color text,
  add column if not exists unit_price numeric;

-- Persist selected size/color and unit price in order items
alter table public.order_items
  add column if not exists selected_size text,
  add column if not exists selected_color text,
  add column if not exists unit_price numeric;
