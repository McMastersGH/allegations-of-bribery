-- migrations/20260128_add_author_timezone.sql
-- Add optional timezone column to authors so we can render times in the author's zone.

ALTER TABLE authors
  ADD COLUMN IF NOT EXISTS timezone text;

-- No index needed for this small column
