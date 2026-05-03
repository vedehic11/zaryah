-- Add "ready" to orders status check constraint
-- Keeps legacy "rto" for backward compatibility
alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in (
    'pending',
    'confirmed',
    'pickup_dispatched',
    'received_by_seller',
    'ready',
    'dispatched',
    'delivered',
    'cancelled',
    'rto'
  ));
