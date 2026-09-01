-- Knowledge base / SOPs for Luna context.
-- Apply in the Supabase SQL editor if it is not run automatically.
-- Requires public.is_workspace_member from 0017.
--
-- Does NOT recreate public.contracts. That table already has contract_number,
-- name (not title), statuses draft/sent/active/completed/cancelled, etc.

CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_workspace
  ON public.knowledge_base (workspace_id, created_at DESC);

ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for knowledge_base" ON public.knowledge_base;
CREATE POLICY "Tenant isolation for knowledge_base"
  ON public.knowledge_base FOR ALL
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_base TO authenticated;

-- Existing contracts table: replace per-command policies with membership helper.
-- Do not alter columns (name, contract_number, active/completed — not title/signed).
DROP POLICY IF EXISTS "Users can view contracts in their workspaces" ON public.contracts;
DROP POLICY IF EXISTS "Users can insert contracts in their workspaces" ON public.contracts;
DROP POLICY IF EXISTS "Users can update contracts in their workspaces" ON public.contracts;
DROP POLICY IF EXISTS "Users can delete contracts in their workspaces" ON public.contracts;
DROP POLICY IF EXISTS "Tenant isolation for contracts" ON public.contracts;
CREATE POLICY "Tenant isolation for contracts"
  ON public.contracts FOR ALL
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));
