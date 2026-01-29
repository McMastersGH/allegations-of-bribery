-- Add optional author badge/profile fields used by the client
ALTER TABLE authors
  ADD COLUMN IF NOT EXISTS credentials text,
  ADD COLUMN IF NOT EXISTS union_affiliation text,
  ADD COLUMN IF NOT EXISTS organization text,
  ADD COLUMN IF NOT EXISTS bio text;

-- Backfill nothing here; this migration only ensures columns exist for upserts
