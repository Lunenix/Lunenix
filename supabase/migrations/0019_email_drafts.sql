-- Workspace email drafts (plain-text body) for Luna and compose flows.
-- Apply in the Supabase SQL editor if it is not run automatically.
-- Requires public.is_workspace_member from 0017.

CREATE TABLE IF NOT EXISTS public.email_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_drafts_workspace
  ON public.email_drafts (workspace_id, created_at DESC);

ALTER TABLE public.email_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for email_drafts" ON public.email_drafts;
CREATE POLICY "Tenant isolation for email_drafts"
  ON public.email_drafts FOR ALL
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

GRANT SELECT, INSERT, UPDATE ON public.email_drafts TO authenticated;
