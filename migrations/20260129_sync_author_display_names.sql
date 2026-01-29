-- RPC to sync an author's display_name into their posts
-- This updates `posts.display_name` to match `authors.display_name` for the given user_id
-- It intentionally does NOT modify `created_at` or any other post fields.

CREATE OR REPLACE FUNCTION public.sync_author_display_name(p_user uuid)
RETURNS integer AS $$
DECLARE
  updated_count integer := 0;
BEGIN
  UPDATE posts p
  SET display_name = a.display_name
  FROM authors a
  WHERE p.author_id = p_user
    AND a.user_id = p_user
    AND (p.display_name IS DISTINCT FROM a.display_name);

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.sync_author_display_name(uuid) TO authenticated;
