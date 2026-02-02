-- Migration: restore public file views WITHOUT storage paths so anon cannot see bucket/object_path
-- This enforces that signing-in is required to retrieve file storage metadata via RPC.
-- Run in staging first.

BEGIN;

DROP VIEW IF EXISTS public.public_post_files CASCADE;
CREATE VIEW public.public_post_files AS
SELECT
  pf.id,
  pf.post_id,
  pf.original_name,
  pf.mime_type,
  pf.created_at
FROM public.post_files pf
JOIN public.posts p ON p.id = pf.post_id
WHERE p.status = 'published';

DROP VIEW IF EXISTS public.public_comment_files CASCADE;
CREATE VIEW public.public_comment_files AS
SELECT
  cf.id,
  cf.comment_id,
  cf.original_name,
  cf.mime_type,
  cf.created_at
FROM public.comment_files cf
JOIN public.comments c ON c.id = cf.comment_id
JOIN public.posts p ON p.id = c.post_id
WHERE p.status = 'published';

-- Ensure anon has SELECT on the public views only
REVOKE ALL ON public.post_files FROM anon;
REVOKE ALL ON public.comment_files FROM anon;

REVOKE ALL ON public.public_post_files FROM anon;
REVOKE ALL ON public.public_comment_files FROM anon;
GRANT SELECT ON public.public_post_files TO anon;
GRANT SELECT ON public.public_comment_files TO anon;

COMMIT;

-- Note: To download files, clients should call the `public.get_file_object(p_file_id)` RPC
-- which will return storage paths only for uploader/admin as configured.
