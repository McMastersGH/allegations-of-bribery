-- RPC to sync an author's display_name into their posts and comments
-- This updates `posts.display_name` and `comments.display_name` to match
-- `authors.display_name` for the given user_id. It does NOT modify timestamps.

CREATE OR REPLACE FUNCTION public.sync_author_display_names_and_comments(p_user uuid)
RETURNS integer AS $$
DECLARE
  posts_updated integer := 0;
  comments_updated integer := 0;
BEGIN
  -- Update posts
  UPDATE posts p
  SET display_name = a.display_name
  FROM authors a
  WHERE p.author_id = p_user
    AND a.user_id = p_user
    AND (p.display_name IS DISTINCT FROM a.display_name);
  GET DIAGNOSTICS posts_updated = ROW_COUNT;

  -- Update comments authored by this user
  UPDATE comments c
  SET display_name = a.display_name
  FROM authors a
  WHERE c.author_id = p_user
    AND a.user_id = p_user
    AND (c.display_name IS DISTINCT FROM a.display_name);
  GET DIAGNOSTICS comments_updated = ROW_COUNT;

  RETURN COALESCE(posts_updated,0) + COALESCE(comments_updated,0);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.sync_author_display_names_and_comments(uuid) TO authenticated;
