-- migrations/20260128_forums_rls.sql
-- Enable RLS on `forums` and allow authenticated clients to upsert forum rows.
-- Run in Supabase SQL editor.

ALTER TABLE forums ENABLE ROW LEVEL SECURITY;

-- Public read access so the UI can list forums
CREATE POLICY forums_select ON forums
  FOR SELECT
  USING (true);

-- Allow authenticated users to insert (create) forum rows. We only check
-- that the request is authenticated; further validation is handled by the
-- application code which constructs the slug/title.
CREATE POLICY forums_insert ON forums
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow authenticated users to update forum rows (used by upsert).
CREATE POLICY forums_update ON forums
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Note: If you prefer that forum creation is only allowed server-side,
-- remove these policies and perform inserts via a server/service role.
