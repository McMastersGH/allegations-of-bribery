-- Migration: Revoke anon access to underlying tables and grant SELECT only on public_* views
-- Run this in staging first (Supabase SQL editor) and verify site behavior before applying to production.

BEGIN;

-- Revoke any privileges anon may have on underlying tables
REVOKE ALL ON TABLE public.posts FROM anon;
REVOKE ALL ON TABLE public.comments FROM anon;
REVOKE ALL ON TABLE public.post_files FROM anon;
REVOKE ALL ON TABLE public.comment_files FROM anon;

-- Revoke any accidental privileges on views, then grant only SELECT to anon
REVOKE ALL ON public.public_posts FROM anon;
REVOKE ALL ON public.public_comments FROM anon;
REVOKE ALL ON public.public_post_files FROM anon;
REVOKE ALL ON public.public_comment_files FROM anon;

GRANT SELECT ON public.public_posts TO anon;
GRANT SELECT ON public.public_comments TO anon;
GRANT SELECT ON public.public_post_files TO anon;
GRANT SELECT ON public.public_comment_files TO anon;

COMMIT;

-- Notes:
-- - Keep `public.get_file_object()` as the authorized RPC for returning bucket/object_path to owners/admins.
-- - Apply this in staging first. After confirming anon site behavior, run in production.
-- - If you use a CI/CD migration runner, include this file in the normal migration ordering.
