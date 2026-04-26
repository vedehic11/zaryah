-- Seller Sections migration
-- Purpose: allow each seller to manage their own custom product sections
-- Safe to run multiple times (idempotent where practical)

-- 1) Table
CREATE TABLE IF NOT EXISTS public.seller_sections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Enforce one section name per seller (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS seller_sections_unique_name_per_seller
ON public.seller_sections (seller_id, lower(name));

-- 3) Optional helper index for listing by seller
CREATE INDEX IF NOT EXISTS seller_sections_seller_id_created_at_idx
ON public.seller_sections (seller_id, created_at);

-- 4) Enable RLS
ALTER TABLE public.seller_sections ENABLE ROW LEVEL SECURITY;

-- 5) Drop old policies if they exist (for re-runs)
DROP POLICY IF EXISTS seller_sections_select_own ON public.seller_sections;
DROP POLICY IF EXISTS seller_sections_insert_own ON public.seller_sections;
DROP POLICY IF EXISTS seller_sections_delete_own ON public.seller_sections;

-- 6) Policies: seller can read/insert/delete only their own rows
-- We map auth.uid() -> users.supabase_auth_id -> users.id (same UUID used in sellers.id)

CREATE POLICY seller_sections_select_own
ON public.seller_sections
FOR SELECT
USING (
  seller_id IN (
    SELECT u.id
    FROM public.users u
    WHERE u.supabase_auth_id = auth.uid()
      AND u.user_type = 'Seller'
  )
);

CREATE POLICY seller_sections_insert_own
ON public.seller_sections
FOR INSERT
WITH CHECK (
  seller_id IN (
    SELECT u.id
    FROM public.users u
    WHERE u.supabase_auth_id = auth.uid()
      AND u.user_type = 'Seller'
  )
);

CREATE POLICY seller_sections_delete_own
ON public.seller_sections
FOR DELETE
USING (
  seller_id IN (
    SELECT u.id
    FROM public.users u
    WHERE u.supabase_auth_id = auth.uid()
      AND u.user_type = 'Seller'
  )
);
