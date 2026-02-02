-- migrations/20260202_forums_admin_policy.sql
-- Add admin_emails table, is_admin() helper, and RLS policies for forums

BEGIN;

-- Table holding emails that are allowed to manage forums from client UI.
CREATE TABLE IF NOT EXISTS public.admin_emails (
  email text PRIMARY KEY
);
COMMENT ON TABLE public.admin_emails IS 'List of admin emails allowed to manage forums from client UI. Populate with real emails.';

-- Helper to check whether the currently-authorized user's JWT email is in admin_emails.
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_emails
    WHERE lower(email) = lower(coalesce((current_setting('request.jwt.claims', true))::json->>'email',''))
  );
$$;

-- Enable Row Level Security for forums and add policies that only admins may insert/update/delete.
ALTER TABLE public.forums ENABLE ROW LEVEL SECURITY;

-- Some Postgres/Supabase environments don't support CREATE POLICY IF NOT EXISTS.
-- Use DROP POLICY IF EXISTS before CREATE to avoid syntax errors.
DROP POLICY IF EXISTS forums_select_all ON public.forums;
CREATE POLICY forums_select_all ON public.forums
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS forums_insert_admins ON public.forums;
CREATE POLICY forums_insert_admins ON public.forums
  FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS forums_update_admins ON public.forums;
CREATE POLICY forums_update_admins ON public.forums
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS forums_delete_admins ON public.forums;
CREATE POLICY forums_delete_admins ON public.forums
  FOR DELETE
  USING (public.is_admin());

COMMIT;
