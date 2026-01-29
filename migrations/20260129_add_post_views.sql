-- Add post_views table to track per-user per-post last seen timestamps
CREATE TABLE IF NOT EXISTS post_views (
  user_id uuid NOT NULL,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  last_seen_at timestamptz,
  PRIMARY KEY (user_id, post_id)
);

-- RPC to return author's posts with comment counts, unviewed counts, and recent comment excerpts
CREATE OR REPLACE FUNCTION public.get_author_threads_unviewed(p_user uuid)
RETURNS TABLE(
  id uuid,
  title text,
  created_at timestamptz,
  forum_slug text,
  comments_count int,
  unviewed_count int,
  recent_comments jsonb
) AS $$
SELECT
  p.id,
  p.title,
  p.created_at,
  p.forum_slug,
  (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments_count,
  (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.created_at > COALESCE((SELECT pv.last_seen_at FROM post_views pv WHERE pv.user_id = p_user AND pv.post_id = p.id), '1970-01-01')) AS unviewed_count,
  (
    SELECT jsonb_agg(jsonb_build_object('id', c.id, 'excerpt', left(c.body, 200), 'created_at', c.created_at, 'display_name', c.display_name) ORDER BY c.created_at DESC)
    FROM (
      SELECT * FROM comments c WHERE c.post_id = p.id ORDER BY c.created_at DESC LIMIT 3
    ) c
  )::jsonb AS recent_comments
FROM posts p
WHERE p.author_id = p_user AND p.status = 'published'
ORDER BY unviewed_count DESC, p.created_at DESC;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION public.get_author_threads_unviewed(uuid) TO anon, authenticated;
