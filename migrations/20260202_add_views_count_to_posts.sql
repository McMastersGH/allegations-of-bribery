-- migrations/20260202_add_views_count_to_posts.sql
-- Add a persistent views_count to posts and provide helper to increment it.

BEGIN;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS views_count bigint NOT NULL DEFAULT 0;

-- Function to increment a post's view count (useful for server-side tracking)
CREATE OR REPLACE FUNCTION public.increment_post_view(p_post_id uuid)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE
  new_count bigint;
BEGIN
  UPDATE public.posts
  SET views_count = COALESCE(views_count,0) + 1
  WHERE id = p_post_id
  RETURNING views_count INTO new_count;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'post not found';
  END IF;

  RETURN new_count;
END;
$$ SECURITY DEFINER;

-- Update public_posts view to include views_count for anonymous clients
CREATE OR REPLACE VIEW public_posts AS
SELECT id, title, body, display_name, forum_slug, created_at, is_anonymous, status, views_count
FROM posts
WHERE status = 'published';

GRANT EXECUTE ON FUNCTION public.increment_post_view(uuid) TO authenticated;

COMMIT;
