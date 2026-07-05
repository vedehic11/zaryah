-- Clean, complete database initialization script for new Supabase project
-- Run this in your new Supabase project: SQL Editor -> New Query -> Run

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users
CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  email character varying NOT NULL UNIQUE,
  name character varying,
  user_type character varying NOT NULL CHECK (user_type::text = ANY (ARRAY['Buyer'::character varying, 'Seller'::character varying, 'Admin'::character varying]::text[])),
  is_verified boolean DEFAULT false,
  is_approved boolean DEFAULT true,
  profile_photo text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  supabase_auth_id uuid UNIQUE,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- 2. Buyers
CREATE TABLE IF NOT EXISTS public.buyers (
  id uuid NOT NULL,
  city character varying DEFAULT 'Mumbai'::character varying,
  address text DEFAULT ''::text,
  state character varying DEFAULT ''::character varying,
  pincode character varying DEFAULT ''::character varying,
  phone character varying DEFAULT ''::character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT buyers_pkey PRIMARY KEY (id),
  CONSTRAINT buyers_id_fkey FOREIGN KEY (id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- 3. Sellers
CREATE TABLE IF NOT EXISTS public.sellers (
  id uuid NOT NULL,
  full_name character varying NOT NULL,
  business_name character varying NOT NULL,
  username character varying UNIQUE CHECK (username IS NULL OR username::text ~ '^[a-z0-9_-]+$'::text AND length(username::text) >= 3 AND length(username::text) <= 50),
  cover_photo text,
  primary_mobile character varying NOT NULL,
  business_address text NOT NULL,
  business_description text NOT NULL,
  city character varying NOT NULL,
  gst_number character varying,
  pan_number character varying,
  id_type character varying NOT NULL CHECK (id_type::text = ANY (ARRAY['Aadhar Card'::character varying, 'PAN Card'::character varying, 'Driving License'::character varying, 'Passport'::character varying]::text[])),
  id_number character varying NOT NULL,
  id_document text NOT NULL,
  business_document text,
  instagram character varying,
  facebook character varying,
  x character varying,
  linkedin character varying,
  alternate_mobile character varying,
  account_holder_name character varying NOT NULL,
  approved_by uuid,
  approved_at timestamp with time zone,
  registration_date timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  state text,
  pincode text,
  story text,
  featured_story boolean DEFAULT false,
  upi_id text,
  allow_cod boolean DEFAULT true,
  hide_from_artisans boolean NOT NULL DEFAULT false,
  CONSTRAINT sellers_pkey PRIMARY KEY (id),
  CONSTRAINT sellers_id_fkey FOREIGN KEY (id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT sellers_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id)
);

-- 4. Admins
CREATE TABLE IF NOT EXISTS public.admins (
  id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admins_pkey PRIMARY KEY (id),
  CONSTRAINT admins_id_fkey FOREIGN KEY (id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- 5. Products
CREATE TABLE IF NOT EXISTS public.products (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  description text NOT NULL,
  price numeric NOT NULL,
  images text[] DEFAULT ARRAY[]::text[],
  video_url text,
  category character varying NOT NULL,
  section character varying NOT NULL,
  weight numeric NOT NULL,
  stock integer NOT NULL DEFAULT 0,
  customisable boolean DEFAULT false,
  custom_questions jsonb,
  features text[] DEFAULT ARRAY[]::text[],
  delivery_time_min integer NOT NULL,
  delivery_time_max integer NOT NULL,
  delivery_time_unit character varying NOT NULL DEFAULT 'days'::character varying CHECK (delivery_time_unit::text = ANY (ARRAY['hours'::character varying, 'days'::character varying]::text[])),
  instant_delivery boolean DEFAULT false,
  seller_id uuid NOT NULL,
  status character varying DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying]::text[])),
  approved_at timestamp with time zone,
  rejected_at timestamp with time zone,
  rejection_reason text,
  approved_by uuid,
  rejected_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  exchange_available boolean DEFAULT false,
  mrp numeric,
  material character varying,
  care_instructions text,
  size_options text[] DEFAULT ARRAY[]::text[],
  return_available boolean DEFAULT false,
  return_days integer DEFAULT 0,
  cod_available boolean DEFAULT true,
  legal_disclaimer text,
  two_way_delivery boolean DEFAULT false,
  size_price_options jsonb DEFAULT '[]'::jsonb,
  color_options jsonb DEFAULT '[]'::jsonb,
  size_charts jsonb DEFAULT '[]'::jsonb,
  categories text[] DEFAULT ARRAY[]::text[],
  sections text[] DEFAULT ARRAY[]::text[],
  archived boolean NOT NULL DEFAULT false,
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id),
  CONSTRAINT products_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id),
  CONSTRAINT products_rejected_by_fkey FOREIGN KEY (rejected_by) REFERENCES public.users(id)
);

-- 6. Addresses
CREATE TABLE IF NOT EXISTS public.addresses (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name character varying NOT NULL,
  phone character varying NOT NULL,
  address text NOT NULL,
  city character varying NOT NULL,
  state character varying NOT NULL,
  pincode character varying NOT NULL,
  country character varying DEFAULT 'India'::character varying,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT addresses_pkey PRIMARY KEY (id),
  CONSTRAINT addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- 7. Carts
CREATE TABLE IF NOT EXISTS public.carts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  buyer_id uuid NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  seller_id uuid,
  CONSTRAINT carts_pkey PRIMARY KEY (id),
  CONSTRAINT carts_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyers(id),
  CONSTRAINT carts_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id)
);

-- 8. Cart Items
CREATE TABLE IF NOT EXISTS public.cart_items (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  cart_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  gift_packaging boolean DEFAULT false,
  customizations jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  selected_size character varying,
  selected_color character varying,
  unit_price numeric,
  CONSTRAINT cart_items_pkey PRIMARY KEY (id),
  CONSTRAINT cart_items_cart_id_fkey FOREIGN KEY (cart_id) REFERENCES public.carts(id) ON DELETE CASCADE,
  CONSTRAINT cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

-- 9. Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  total_amount numeric NOT NULL,
  status character varying DEFAULT 'pending'::character varying,
  payment_method character varying NOT NULL DEFAULT 'cod'::character varying,
  payment_status character varying DEFAULT 'pending'::character varying,
  payment_id text,
  razorpay_order_id text,
  razorpay_payment_id text,
  address text NOT NULL,
  notes text,
  shipment_id character varying,
  shipment_status character varying,
  awb_code character varying,
  courier_name character varying,
  tracking_url text,
  label_url text,
  manifest_url text,
  delivery_fee numeric DEFAULT 0,
  gift_packaging_fee numeric DEFAULT 0,
  platform_fee numeric DEFAULT 0,
  commission_amount numeric DEFAULT 0,
  seller_amount numeric DEFAULT 0,
  two_way_delivery boolean DEFAULT false,
  wallet_credited boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyers(id),
  CONSTRAINT orders_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id)
);

-- 10. Order Items
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  order_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  customizations jsonb,
  gift_packaging boolean DEFAULT false,
  price numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  selected_size character varying,
  selected_color character varying,
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE,
  CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

-- 11. Product Ratings
CREATE TABLE IF NOT EXISTS public.product_ratings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  product_id uuid NOT NULL,
  user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review text,
  date timestamp with time zone DEFAULT now(),
  title text,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT product_ratings_pkey PRIMARY KEY (id),
  CONSTRAINT product_ratings_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT product_ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- 12. Reviews
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  product_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  images text[] DEFAULT ARRAY[]::text[],
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT reviews_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyers(id)
);

-- 13. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  user_model character varying NOT NULL CHECK (user_model::text = ANY (ARRAY['Buyer'::character varying, 'Seller'::character varying, 'Admin'::character varying]::text[])),
  title character varying NOT NULL,
  message text NOT NULL,
  type character varying DEFAULT 'system'::character varying CHECK (type::text = ANY (ARRAY['order'::character varying, 'payment'::character varying, 'delivery'::character varying, 'system'::character varying, 'promotion'::character varying]::text[])),
  is_read boolean DEFAULT false,
  related_order_id uuid,
  related_product_id uuid,
  action_url text,
  priority character varying DEFAULT 'medium'::character varying CHECK (priority::text = ANY (ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying]::text[])),
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT notifications_related_order_id_fkey FOREIGN KEY (related_order_id) REFERENCES public.orders(id),
  CONSTRAINT notifications_related_product_id_fkey FOREIGN KEY (related_product_id) REFERENCES public.products(id)
);

-- 14. Support Tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  category text NOT NULL,
  status text DEFAULT 'open'::text,
  priority text DEFAULT 'normal'::text,
  order_reference_id uuid,
  product_reference_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT support_tickets_pkey PRIMARY KEY (id),
  CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT support_tickets_order_reference_id_fkey FOREIGN KEY (order_reference_id) REFERENCES public.orders(id),
  CONSTRAINT support_tickets_product_reference_id_fkey FOREIGN KEY (product_reference_id) REFERENCES public.products(id)
);

-- 15. Support Messages
CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  ticket_id uuid NOT NULL,
  sender character varying NOT NULL CHECK (sender::text = ANY (ARRAY['user'::character varying, 'seller'::character varying, 'admin'::character varying]::text[])),
  sender_id uuid NOT NULL,
  message text NOT NULL,
  attachments jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT support_messages_pkey PRIMARY KEY (id),
  CONSTRAINT support_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  CONSTRAINT support_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id)
);

-- 16. OTPs
CREATE TABLE IF NOT EXISTS public.otps (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  email character varying NOT NULL,
  otp character varying NOT NULL,
  user_type character varying NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  is_used boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT otps_pkey PRIMARY KEY (id)
);

-- 17. Email Verifications
CREATE TABLE IF NOT EXISTS public.email_verifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  verified_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT email_verifications_pkey PRIMARY KEY (id),
  CONSTRAINT email_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- 18. Wallets
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL UNIQUE,
  available_balance numeric NOT NULL DEFAULT 0.00 CHECK (available_balance >= 0::numeric),
  pending_balance numeric NOT NULL DEFAULT 0.00 CHECK (pending_balance >= 0::numeric),
  total_earned numeric NOT NULL DEFAULT 0.00,
  total_withdrawn numeric NOT NULL DEFAULT 0.00,
  last_withdrawal_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT wallets_pkey PRIMARY KEY (id),
  CONSTRAINT wallets_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id)
);

-- 19. Transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  order_id uuid,
  amount numeric NOT NULL,
  type character varying NOT NULL CHECK (type::text = ANY (ARRAY['credit_pending'::character varying, 'credit_available'::character varying, 'debit_withdrawal'::character varying, 'debit_refund'::character varying, 'commission_deducted'::character varying, 'reversal_rto'::character varying, 'adjustment'::character varying]::text[])),
  status character varying DEFAULT 'completed'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'completed'::character varying, 'failed'::character varying, 'reversed'::character varying]::text[])),
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id),
  CONSTRAINT transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);

-- 20. Admin Earnings
CREATE TABLE IF NOT EXISTS public.admin_earnings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE,
  seller_id uuid NOT NULL,
  order_amount numeric NOT NULL,
  commission_rate numeric NOT NULL DEFAULT 5.00,
  commission_amount numeric NOT NULL,
  seller_amount numeric NOT NULL,
  status character varying DEFAULT 'earned'::character varying CHECK (status::text = ANY (ARRAY['earned'::character varying, 'reversed'::character varying]::text[])),
  earned_at timestamp with time zone DEFAULT now(),
  reversed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  delivery_fee numeric DEFAULT 0,
  CONSTRAINT admin_earnings_pkey PRIMARY KEY (id),
  CONSTRAINT admin_earnings_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT admin_earnings_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id)
);

-- 21. Withdrawal Requests
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  status character varying DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'failed'::character varying]::text[])),
  upi_id text,
  bank_details jsonb,
  payout_mode text DEFAULT 'manual'::text,
  manual_transaction_id text,
  razorpay_payout_id text,
  failure_reason text,
  processed_at timestamp with time zone,
  processed_by uuid,
  transaction_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT withdrawal_requests_pkey PRIMARY KEY (id),
  CONSTRAINT withdrawal_requests_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id),
  CONSTRAINT withdrawal_requests_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id),
  CONSTRAINT withdrawal_requests_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.users(id)
);

-- 22. Wishlist
CREATE TABLE IF NOT EXISTS public.wishlist (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT wishlist_pkey PRIMARY KEY (id),
  CONSTRAINT wishlist_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT wishlist_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE
);

-- 23. Support Ticket Messages
CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  message text NOT NULL,
  is_admin boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT support_ticket_messages_pkey PRIMARY KEY (id),
  CONSTRAINT support_ticket_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  CONSTRAINT support_ticket_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id)
);

-- 24. Seller Sections
CREATE TABLE IF NOT EXISTS public.seller_sections (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  seller_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  image_url text,
  CONSTRAINT seller_sections_pkey PRIMARY KEY (id),
  CONSTRAINT seller_sections_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE CASCADE
);

-- 25. Seller Reviews
CREATE TABLE IF NOT EXISTS public.seller_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title text,
  comment text NOT NULL DEFAULT ''::text,
  images text[] DEFAULT ARRAY[]::text[],
  order_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT seller_reviews_pkey PRIMARY KEY (id)
);
