-- migrations/20260128_add_union_matters.sql
-- Add the `union-matters` forum used by the website.
-- Run via Supabase SQL editor, psql, or your migration runner.

INSERT INTO forums (slug, title, description)
VALUES (
  'union-matters',
  'Union Matters',
  'Discuss union organizing, labor disputes, contracts, and member issues.'
)
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      description = EXCLUDED.description;

-- Optional: if you'd like to move existing posts from the old `introductions`
-- forum into the new slug, uncomment and run the following:
--
-- UPDATE posts
-- SET forum_slug = 'union-matters'
-- WHERE forum_slug = 'introductions';
