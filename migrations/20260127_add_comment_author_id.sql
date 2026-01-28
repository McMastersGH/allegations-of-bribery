-- migrations/20260127_add_comment_author_id.sql
-- Add an optional author_id to comments so we can track who created a comment.
-- This column is nullable to preserve existing rows.

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS author_id uuid;

-- Optional index to speed up lookups by author
CREATE INDEX IF NOT EXISTS comments_author_id_idx ON comments(author_id);

-- Note: consider adding a foreign key constraint to authors.user_id in a later migration
-- if you want stricter referential integrity:
-- ALTER TABLE comments ADD CONSTRAINT comments_author_fk FOREIGN KEY (author_id) REFERENCES authors(user_id);
