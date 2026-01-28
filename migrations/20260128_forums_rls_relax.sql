-- migrations/20260128_forums_rls_relax.sql
-- Relax forums INSERT/UPDATE policies to avoid client upsert permission errors.
-- Run in Supabase SQL editor.

-- Drop existing policies (if any)
DROP POLICY IF EXISTS forums_insert ON forums;
DROP POLICY IF EXISTS forums_update ON forums;

-- Allow inserts/unrestricted (useful for client upsert that ensures forum exists)
CREATE POLICY forums_insert ON forums
  FOR INSERT
  WITH CHECK (true);

-- Allow updates unrestricted (used by upsert)
CREATE POLICY forums_update ON forums
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Note: this is permissive. If you'd prefer stricter control, we can instead
-- allow only authenticated users: change WITH CHECK (auth.uid() IS NOT NULL).
