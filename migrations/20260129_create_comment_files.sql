-- migrations/20260129_create_comment_files.sql
-- Create table for comment attachments
CREATE TABLE IF NOT EXISTS comment_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  author_id uuid,
  bucket text,
  object_path text,
  original_name text,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
