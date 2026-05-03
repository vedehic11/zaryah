-- Two-way delivery support
-- Run in Supabase SQL editor

alter table if exists public.products
  add column if not exists two_way_delivery boolean default false;

alter table if exists public.orders
  add column if not exists two_way_delivery boolean default false,
  add column if not exists inbound_shipment_id text,
  add column if not exists inbound_awb_code text,
  add column if not exists inbound_courier_name text,
  add column if not exists inbound_tracking_url text,
  add column if not exists inbound_shipment_status text,
  add column if not exists inbound_shipment_created_at timestamptz;
