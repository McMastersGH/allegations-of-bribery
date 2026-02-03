-- migrations/20260202_grant_increment_post_view_to_anon.sql
-- Allow anonymous clients to call the increment_post_view RPC so public views are counted.

BEGIN;

GRANT EXECUTE ON FUNCTION public.increment_post_view(uuid) TO anon;

COMMIT;
