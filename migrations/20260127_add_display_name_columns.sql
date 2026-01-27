-- migrations/20260127_add_display_name_columns.sql
-- Adds `display_name` columns to posts and comments and copies legacy
-- `author_label` values into the new column for backward compatibility.

ALTER TABLE posts ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS display_name text;

-- Backfill from legacy author_label (if present). This is safe to run
-- multiple times because it only sets display_name when it's NULL.
UPDATE posts SET display_name = author_label
  WHERE display_name IS NULL AND author_label IS NOT NULL;

-- Optionally, copy comment display_name if you used a different legacy
-- field; if comments already used `display_name` this is a no-op.
-- (kept here for symmetry)
UPDATE comments SET display_name = display_name
  WHERE display_name IS NULL;
