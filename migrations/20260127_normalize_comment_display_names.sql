-- migrations/20260127_normalize_comment_display_names.sql
-- Normalize legacy comment display names:
-- 1) Remove placeholder "Chose Anonymity" and clear display_name for anonymous comments
-- 2) Set explicit "Member" for non-anonymous comments that lack a display name

-- Clear placeholders and anonymous display names
UPDATE comments
SET display_name = NULL
WHERE is_anonymous = true
   OR display_name = 'Chose Anonymity';

-- Ensure non-anonymous comments have an explicit fallback
UPDATE comments
SET display_name = 'Member'
WHERE display_name IS NULL
  AND is_anonymous = false;
