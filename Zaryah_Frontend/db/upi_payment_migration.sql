-- Replace bank account fields with UPI ID for payment
alter table public.sellers
  drop column if exists account_number,
  drop column if exists ifsc_code,
  add column if not exists upi_id text;

-- Update sellers table to ensure account_holder_name and upi_id are present
comment on column public.sellers.account_holder_name is 'Account holder name for UPI payments';
comment on column public.sellers.upi_id is 'UPI ID for receiving payments (e.g., yourname@upi)';
