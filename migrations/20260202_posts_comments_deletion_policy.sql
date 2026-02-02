-- migrations/20260202_posts_comments_deletion_policy.sql
-- Enable RLS on posts/comments, add admin-only delete policies, and add deletion_logs + log_deletion

BEGIN;

-- Table to record deletion actions for audit
CREATE TABLE IF NOT EXISTS public.deletion_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL, -- 'forum' | 'post' | 'comment'
  entity_id text NOT NULL,
  reason text,
  actor_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.deletion_logs IS 'Audit log of deletions performed via admin UI or API.';

-- SECURITY DEFINER helper to record deletions using the JWT email if available
CREATE OR REPLACE FUNCTION public.log_deletion(p_entity_type text, p_entity_id text, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.deletion_logs(entity_type, entity_id, reason, actor_email, created_at)
  VALUES (p_entity_type, p_entity_id, p_reason, coalesce((current_setting('request.jwt.claims', true))::json->>'email',''), now());
END;
$$;

-- Enable RLS and only allow deletes by admins for posts and comments
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS posts_delete_admins ON public.posts;
CREATE POLICY posts_delete_admins ON public.posts
  FOR DELETE
  USING (public.is_admin());

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS comments_delete_admins ON public.comments;
CREATE POLICY comments_delete_admins ON public.comments
  FOR DELETE
  USING (public.is_admin());

COMMIT;
