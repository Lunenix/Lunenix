-- Workspace activity feed for Luna context aggregation.
-- Apply in the Supabase SQL editor if it is not run automatically.
-- Requires public.is_workspace_member from 0017.

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'luna')),
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_workspace
  ON public.activity_logs (workspace_id, created_at DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for activity_logs" ON public.activity_logs;
CREATE POLICY "Tenant isolation for activity_logs"
  ON public.activity_logs FOR ALL
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
