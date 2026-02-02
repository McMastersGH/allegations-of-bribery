-- Migration: include storage paths in public_* file views so anon users can download attachments
-- Run in staging first and verify that your storage buckets are configured public (or objects are publicly accessible).

BEGIN;

-- Recreate public_post_files to include bucket and object_path for anon consumption
DROP VIEW IF EXISTS public.public_post_files CASCADE;
CREATE VIEW public.public_post_files AS
SELECT
  pf.id,
  pf.post_id,
  pf.original_name,
  pf.mime_type,
  pf.created_at,
  pf.bucket,
  pf.object_path
FROM public.post_files pf
JOIN public.posts p ON p.id = pf.post_id
WHERE p.status = 'published';

-- Recreate public_comment_files to include bucket and object_path for anon consumption
DROP VIEW IF EXISTS public.public_comment_files CASCADE;
CREATE VIEW public.public_comment_files AS
SELECT
  cf.id,
  cf.comment_id,
  cf.original_name,
  cf.mime_type,
  cf.created_at,
  cf.bucket,
  cf.object_path
FROM public.comment_files cf
JOIN public.comments c ON c.id = cf.comment_id
JOIN public.posts p ON p.id = c.post_id
WHERE p.status = 'published';

-- Ensure anon can SELECT these views
GRANT SELECT ON public.public_post_files TO anon;
GRANT SELECT ON public.public_comment_files TO anon;

COMMIT;

-- IMPORTANT: For anon users to actually download files using the Supabase Storage public URL,
-- the storage bucket must be configured to allow public access (see Supabase storage settings).
-- If the bucket is private, consider keeping get_file_object RPC and returning signed URLs for downloads.
