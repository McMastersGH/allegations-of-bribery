-- migrations/20260130_public_file_views.sql
-- Create public views for post_files and comment_files that expose only
-- safe metadata for published posts/comments and grant SELECT to anon.

CREATE OR REPLACE VIEW public_post_files AS
SELECT pf.id, pf.post_id, pf.bucket, pf.object_path, pf.original_name, pf.mime_type, pf.created_at
FROM post_files pf
JOIN posts p ON p.id = pf.post_id
WHERE p.status = 'published';

CREATE OR REPLACE VIEW public_comment_files AS
SELECT cf.id, cf.comment_id, cf.bucket, cf.object_path, cf.original_name, cf.mime_type, cf.created_at
FROM comment_files cf
JOIN comments c ON c.id = cf.comment_id
JOIN posts p ON p.id = c.post_id
WHERE p.status = 'published';

GRANT SELECT ON public_post_files TO anon;
GRANT SELECT ON public_comment_files TO anon;

-- Optionally revoke direct table SELECT if you want to force view usage:
-- REVOKE SELECT ON post_files FROM anon;
-- REVOKE SELECT ON comment_files FROM anon;
