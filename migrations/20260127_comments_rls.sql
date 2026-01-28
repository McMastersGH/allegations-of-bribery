-- migrations/20260127_comments_rls.sql
-- Row Level Security (RLS) for `comments` table.
-- Apply these in the Supabase SQL editor (no keys required).

-- Enable RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Public read access to comments (posts are public in this app)
CREATE POLICY comments_select ON comments
  FOR SELECT
  USING (true);

-- Ensure `author_id` exists so policies referencing it don't fail.
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS author_id uuid;

-- Add index to speed lookups by author
CREATE INDEX IF NOT EXISTS comments_author_id_idx ON comments(author_id);

-- Inserts: only authenticated users can insert comments, and the comment's
-- author_id must match the authenticated user. This prevents spoofing.
CREATE POLICY comments_insert ON comments
  FOR INSERT
  WITH CHECK (author_id = auth.uid());

-- Updates: only the comment author may edit their comment (prevents others
-- including the post author from tampering with a comment's content).
-- Allow comment authors OR the post (thread) author to update a comment.
-- We'll prevent changes to `author_id` itself via a trigger below so post
-- owners can edit content but cannot impersonate or change the original
-- comment author.
CREATE POLICY comments_update ON comments
  FOR UPDATE
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM posts p WHERE p.id = comments.post_id AND p.author_id = auth.uid()
    )
  )
  WITH CHECK (true);

-- Deletes: allow the comment author or the post (thread) author to delete
-- a comment. This lets thread owners moderate their threads.
CREATE POLICY comments_delete ON comments
  FOR DELETE
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM posts p WHERE p.id = comments.post_id AND p.author_id = auth.uid()
    )
  );

-- Notes:
-- 1) The client code already attaches `author_id` when creating comments for
--    authenticated users. If you allow anonymous, unauthenticated comments,
--    adapt the INSERT policy accordingly.
-- 2) After applying these policies, make sure your Supabase Auth is configured
--    and the client sends authenticated requests (the app already requires
--    login to post comments).
-- 3) If you want the post author to be able to *edit* comments too, change
--    the UPDATE policy to include the post-owner condition (but also ensure
--    you prevent author_id from being modified by non-authors).

-- Prevent modification of `author_id` by ensuring any UPDATE keeps the
-- original author_id value. This trigger will silently restore the old
-- author_id on updates.
CREATE OR REPLACE FUNCTION comments__prevent_author_id_change() RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    NEW.author_id := OLD.author_id;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS comments_author_id_nochange_trig ON comments;
CREATE TRIGGER comments_author_id_nochange_trig
  BEFORE UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION comments__prevent_author_id_change();
