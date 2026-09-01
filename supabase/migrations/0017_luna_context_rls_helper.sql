-- Luna context: custom instructions + membership helper + insert WITH CHECK.
-- Does NOT recreate contacts/projects/tasks/invoices — those already exist
-- with first_name/organization_name, total, todo/medium, planning/cancelled, etc.
-- Apply in the Supabase SQL editor if it is not run automatically.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. Luna custom instructions (workspace_ai_settings already has id + unique workspace_id)
-- ============================================================================

ALTER TABLE public.workspace_ai_settings
  ADD COLUMN IF NOT EXISTS custom_instructions TEXT;

CREATE INDEX IF NOT EXISTS idx_workspace_members_user
  ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace
  ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contacts_workspace ON public.contacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON public.projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON public.tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invoices_workspace ON public.invoices(workspace_id);

-- ============================================================================
-- 2. Membership helper (SECURITY DEFINER avoids RLS recursion on workspace_members)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_workspace_member(target_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF target_workspace_id IS NULL OR auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = target_workspace_id
      AND user_id = auth.uid()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_workspace_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID) TO authenticated;

-- ============================================================================
-- 3. Tenant policies: USING + WITH CHECK via membership helper
-- ============================================================================

DROP POLICY IF EXISTS "workspace_members_contacts" ON public.contacts;
CREATE POLICY "workspace_members_contacts" ON public.contacts
  FOR ALL
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "workspace_members_projects" ON public.projects;
CREATE POLICY "workspace_members_projects" ON public.projects
  FOR ALL
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "workspace_members_tasks" ON public.tasks;
CREATE POLICY "workspace_members_tasks" ON public.tasks
  FOR ALL
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Users can view invoices in their workspaces" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert invoices in their workspaces" ON public.invoices;
DROP POLICY IF EXISTS "Users can update invoices in their workspaces" ON public.invoices;
DROP POLICY IF EXISTS "Users can delete invoices in their workspaces" ON public.invoices;
CREATE POLICY "Tenant isolation for invoices"
  ON public.invoices FOR ALL
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "workspace_ai_settings_select" ON public.workspace_ai_settings;
CREATE POLICY "workspace_ai_settings_select" ON public.workspace_ai_settings
  FOR SELECT
  USING (public.is_workspace_member(workspace_id));
