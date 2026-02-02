-- migrations/20260130_public_views_and_file_rbac.sql
-- Create public views that expose only non-sensitive columns and adjust anon access.
-- Run in Supabase SQL editor.

-- Public posts view (only published threads)
CREATE OR REPLACE VIEW public_posts AS
SELECT id, title, body, display_name, forum_slug, created_at, is_anonymous, status
FROM posts
WHERE status = 'published';

-- Replace view by dropping first so we can change the column list safely.
DROP VIEW IF EXISTS public_comments;
CREATE OR REPLACE VIEW public_comments AS
SELECT c.id, c.post_id, c.parent_id, c.body, c.display_name, c.created_at, c.is_anonymous
FROM comments c
JOIN posts p ON p.id = c.post_id
WHERE p.status = 'published';

-- Revoke direct SELECT on underlying tables from anon role and grant SELECT on views
REVOKE SELECT ON posts FROM anon;
REVOKE SELECT ON comments FROM anon;

GRANT SELECT ON public_posts TO anon;
GRANT SELECT ON public_comments TO anon;

-- Public file metadata views (exclude storage object paths and buckets)
CREATE OR REPLACE VIEW public_post_files AS
SELECT pf.id, pf.post_id, pf.original_name, pf.mime_type, pf.created_at
FROM post_files pf
JOIN posts p ON p.id = pf.post_id
WHERE p.status = 'published';

CREATE OR REPLACE VIEW public_comment_files AS
SELECT cf.id, cf.comment_id, cf.original_name, cf.mime_type, cf.created_at
FROM comment_files cf
JOIN comments c ON c.id = cf.comment_id
JOIN posts p ON p.id = c.post_id
WHERE p.status = 'published';

-- Revoke direct SELECT on underlying file tables from anon role and grant select on views
REVOKE SELECT ON post_files FROM anon;
REVOKE SELECT ON comment_files FROM anon;

GRANT SELECT ON public_post_files TO anon;
GRANT SELECT ON public_comment_files TO anon;

-- Note: This migration intentionally preserves table-level access for authenticated
-- users but prevents anonymous (public) clients using the anon key from directly
-- selecting author-identifying columns such as `author_id` or `object_path`.

-- Optional: create an admin-only RPC to fetch file object paths for investigation.
-- This function returns the bucket/object_path for a given file id but only when
-- called by the file owner or a privileged role. It is SECURITY DEFINER so it can
-- validate auth.uid() and jwt claims.
CREATE OR REPLACE FUNCTION public.get_file_object(p_file_id uuid)
RETURNS TABLE(bucket text, object_path text, mime_type text, original_name text) AS $$
DECLARE
  v_bucket text;
  v_object text;
  v_mime text;
  v_name text;
  v_owner uuid;
  v_role text := current_setting('jwt.claims.role', true);
  v_uid uuid := auth.uid();
BEGIN
  -- Ensure function runs with a safe search_path to avoid privilege escalation
  PERFORM set_config('search_path', 'public', true);
  -- Try post_files
  SELECT bucket, object_path, mime_type, original_name, author_id
    INTO v_bucket, v_object, v_mime, v_name, v_owner
    FROM post_files WHERE id = p_file_id LIMIT 1;

  IF NOT FOUND THEN
    -- Try comment_files
    SELECT bucket, object_path, mime_type, original_name, author_id
      INTO v_bucket, v_object, v_mime, v_name, v_owner
      FROM comment_files WHERE id = p_file_id LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'file not found';
  END IF;

  -- Allow if caller is the uploader (author) or has admin role
  IF v_uid IS NOT NULL AND v_uid = v_owner THEN
    RETURN QUERY SELECT v_bucket, v_object, v_mime, v_name;
    RETURN;
  END IF;

  IF v_role IS NOT NULL AND v_role = 'admin' THEN
    RETURN QUERY SELECT v_bucket, v_object, v_mime, v_name;
    RETURN;
  END IF;

  -- Otherwise deny access
  RAISE EXCEPTION 'not authorized to access file metadata';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
