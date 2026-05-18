-- Add soft-archive support for products
-- Run this in the Supabase SQL editor or as a migration.

alter table public.products
  add column if not exists archived boolean not null default false;

-- Backfill existing rows explicitly in case the column existed without a default
update public.products
set archived = false
where archived is null;

-- Helpful for listing active products and filtering archived items
create index if not exists idx_products_archived on public.products (archived);

-- Optional: keep archive state visible in dashboards by default through existing queries.
-- No data is removed by this migration.
