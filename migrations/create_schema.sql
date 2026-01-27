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
