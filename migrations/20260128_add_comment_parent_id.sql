-- migrations/20260128_add_comment_parent_id.sql
-- Add optional parent_id to comments so replies can be associated with a parent comment.

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS comments_parent_id_idx ON comments(parent_id);
