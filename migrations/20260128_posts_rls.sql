-- migrations/20260128_posts_rls.sql
-- Enable RLS on `posts` and allow authors to update/delete their own posts.
-- Run in Supabase SQL editor.

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Public read access to posts (published posts are filtered client-side)
CREATE POLICY posts_select ON posts
  FOR SELECT
  USING (true);

-- Inserts: only authenticated users may insert posts (app enforces this)
CREATE POLICY posts_insert ON posts
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Updates: allow the original author or a privileged role to update posts
CREATE POLICY posts_update ON posts
  FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Deletes: allow the original author or a privileged role to delete posts
CREATE POLICY posts_delete ON posts
  FOR DELETE
  USING (author_id = auth.uid());

-- Note: if you need moderators/admins to manage posts, adjust policies
-- to allow a specific role (e.g., current_setting('jwt.claims.role') = 'admin').
