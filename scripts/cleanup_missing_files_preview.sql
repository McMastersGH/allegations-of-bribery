-- scripts/cleanup_missing_files_preview.sql
-- Preview-only cleanup SQL for DB rows whose storage objects are missing.
--
-- This file is intended as a human-reviewed preview. Run `node scripts/check_storage_files.cjs`
-- to generate a CSV report `scripts/missing_storage_objects.csv` and a populated preview
-- SQL file. The generated SQL will contain commented DELETE statements — review and then
-- remove the leading `-- ` to execute them inside a transaction.

BEGIN;
-- DELETE FROM post_files WHERE id IN ( /* ids populated by the report */ );
-- DELETE FROM comment_files WHERE id IN ( /* ids populated by the report */ );
-- COMMIT;

-- Notes:
-- - This SQL deletes only DB rows that reference missing storage objects. It does NOT
--   touch any storage bucket contents.
-- - Review the CSV report before running the DELETEs. Consider re-running the script
--   after any manual fixes to the storage bucket.
