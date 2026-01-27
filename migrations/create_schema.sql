-- migrations/create_schema.sql
-- Run in Supabase SQL editor (adjust types as needed)

-- posts
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  forum_slug text NOT NULL,
  author_id uuid NOT NULL,
  display_name text,
  status text NOT NULL DEFAULT 'draft',
  is_anonymous boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- comments
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  body text NOT NULL,
  display_name text,
  is_anonymous boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- post_files
CREATE TABLE IF NOT EXISTS post_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  author_id uuid,
  bucket text,
  object_path text,
  original_name text,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- authors
CREATE TABLE IF NOT EXISTS authors (
  user_id uuid PRIMARY KEY,
  display_name text,
  approved boolean NOT NULL DEFAULT false,
  is_anonymous boolean NOT NULL DEFAULT false
);

-- forums
CREATE TABLE IF NOT EXISTS forums (
  slug text PRIMARY KEY,
  title text,
  description text
);

-- Note: create storage bucket `post-uploads` in Supabase Storage UI.

-- View: aggregated forum statistics (threads + comments)
-- This view is optional; the client will fall back to raw queries if it's not present.
-- Use CREATE OR REPLACE VIEW for broader Postgres compatibility.
CREATE OR REPLACE VIEW forum_stats AS
SELECT
  f.slug,
  COUNT(DISTINCT p.id) AS threads,
  COALESCE(SUM(pc.cnt), 0) AS comments
FROM forums f
LEFT JOIN posts p ON p.forum_slug = f.slug AND p.status = 'published'
LEFT JOIN (
  SELECT post_id, COUNT(*) AS cnt FROM comments GROUP BY post_id
) pc ON pc.post_id = p.id
GROUP BY f.slug;

-- Maintain counters on `forums` for fast reads. Columns are added if missing.
ALTER TABLE forums ADD COLUMN IF NOT EXISTS posts_count bigint NOT NULL DEFAULT 0;
ALTER TABLE forums ADD COLUMN IF NOT EXISTS comments_count bigint NOT NULL DEFAULT 0;

-- Function to maintain posts_count on posts insert/update/delete
CREATE OR REPLACE FUNCTION forums__maintain_posts_count() RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.status = 'published' THEN
      UPDATE forums SET posts_count = posts_count + 1 WHERE slug = NEW.forum_slug;
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    IF OLD.status = 'published' THEN
      UPDATE forums SET posts_count = GREATEST(posts_count - 1, 0) WHERE slug = OLD.forum_slug;
    END IF;
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- If forum slug or status changed, adjust old and new counts accordingly
    IF OLD.forum_slug IS DISTINCT FROM NEW.forum_slug OR OLD.status IS DISTINCT FROM NEW.status THEN
      IF OLD.status = 'published' THEN
        UPDATE forums SET posts_count = GREATEST(posts_count - 1, 0) WHERE slug = OLD.forum_slug;
      END IF;
      IF NEW.status = 'published' THEN
        UPDATE forums SET posts_count = posts_count + 1 WHERE slug = NEW.forum_slug;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call posts counter function
DROP TRIGGER IF EXISTS forums_posts_count_trig ON posts;
CREATE TRIGGER forums_posts_count_trig
AFTER INSERT OR UPDATE OR DELETE ON posts
FOR EACH ROW EXECUTE FUNCTION forums__maintain_posts_count();

-- Function to maintain comments_count on comments insert/update/delete
CREATE OR REPLACE FUNCTION forums__maintain_comments_count() RETURNS trigger AS $$
DECLARE
  forum_slug text;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    SELECT forum_slug INTO forum_slug FROM posts WHERE id = NEW.post_id LIMIT 1;
    IF forum_slug IS NOT NULL THEN
      UPDATE forums SET comments_count = comments_count + 1 WHERE slug = forum_slug;
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    SELECT forum_slug INTO forum_slug FROM posts WHERE id = OLD.post_id LIMIT 1;
    IF forum_slug IS NOT NULL THEN
      UPDATE forums SET comments_count = GREATEST(comments_count - 1, 0) WHERE slug = forum_slug;
    END IF;
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- If post_id changed, decrement old forum and increment new forum
    IF OLD.post_id IS DISTINCT FROM NEW.post_id THEN
      SELECT forum_slug INTO forum_slug FROM posts WHERE id = OLD.post_id LIMIT 1;
      IF forum_slug IS NOT NULL THEN
        UPDATE forums SET comments_count = GREATEST(comments_count - 1, 0) WHERE slug = forum_slug;
      END IF;
      SELECT forum_slug INTO forum_slug FROM posts WHERE id = NEW.post_id LIMIT 1;
      IF forum_slug IS NOT NULL THEN
        UPDATE forums SET comments_count = comments_count + 1 WHERE slug = forum_slug;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call comments counter function
DROP TRIGGER IF EXISTS forums_comments_count_trig ON comments;
CREATE TRIGGER forums_comments_count_trig
AFTER INSERT OR UPDATE OR DELETE ON comments
FOR EACH ROW EXECUTE FUNCTION forums__maintain_comments_count();
