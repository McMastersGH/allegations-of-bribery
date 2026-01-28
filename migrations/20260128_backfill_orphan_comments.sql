-- migrations/20260128_backfill_orphan_comments.sql
-- Backfill orphan comments (author_id IS NULL) as anonymous and
-- update the INSERT policy to allow anonymous comments.

-- 1) Backfill: mark comments without author as anonymous and clear display_name
UPDATE comments
SET display_name = NULL,
    is_anonymous = true
WHERE author_id IS NULL;

-- 2) Replace INSERT policy to allow either:
--    - authenticated inserts where author_id = auth.uid()
--    - OR anonymous inserts where author_id IS NULL AND is_anonymous = true
DROP POLICY IF EXISTS comments_insert ON comments;
CREATE POLICY comments_insert ON comments
  FOR INSERT
  WITH CHECK (
    (author_id IS NOT NULL AND author_id = auth.uid())
    OR (author_id IS NULL AND is_anonymous = true)
  );

-- Notes:
-- - This keeps the app secure against author spoofing while permitting
--   anonymous comments. The UI still requires login to post, so anonymous
--   inserts are unlikely unless you intentionally change the client.
-- - Run this once in the Supabase SQL editor.
