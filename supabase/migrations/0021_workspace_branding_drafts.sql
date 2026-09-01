-- Workspace branding/portal fields, schedulable email drafts, storage bucket.
-- Does NOT recreate public.forms (name/fields/status already exist).
-- Apply in the Supabase SQL editor if it is not run automatically.

-- ============================================================================
-- 1. Workspaces: branding + custom portal
-- ============================================================================

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#0f172a',
  ADD COLUMN IF NOT EXISTS portal_slug TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_portal_slug
  ON public.workspaces (portal_slug)
  WHERE portal_slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_custom_domain
  ON public.workspaces (custom_domain)
  WHERE custom_domain IS NOT NULL;

-- ============================================================================
-- 2. Email drafts: cron scheduling (keep archived)
-- ============================================================================

ALTER TABLE public.email_drafts
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

ALTER TABLE public.email_drafts
  DROP CONSTRAINT IF EXISTS email_drafts_status_check;

ALTER TABLE public.email_drafts
  ADD CONSTRAINT email_drafts_status_check
  CHECK (status IN ('draft', 'scheduled', 'sent', 'failed', 'archived'));

CREATE INDEX IF NOT EXISTS idx_email_drafts_scheduled
  ON public.email_drafts (status, scheduled_at)
  WHERE status = 'scheduled';

-- ============================================================================
-- 3. Existing forms: optional portal slug only (not title/schema/is_active)
-- ============================================================================

ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_forms_workspace_slug
  ON public.forms (workspace_id, slug)
  WHERE slug IS NOT NULL;

DROP POLICY IF EXISTS "Users can view forms in their workspaces" ON public.forms;
DROP POLICY IF EXISTS "Users can insert forms in their workspaces" ON public.forms;
DROP POLICY IF EXISTS "Users can update forms in their workspaces" ON public.forms;
DROP POLICY IF EXISTS "Users can delete forms in their workspaces" ON public.forms;
DROP POLICY IF EXISTS "Tenant isolation for forms" ON public.forms;
CREATE POLICY "Tenant isolation for forms"
  ON public.forms FOR ALL
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

-- Public form fill stays on /api/forms/[id] with the admin client.
-- Do not add USING (is_active) SELECT for anon — that would list every
-- workspace's active forms.

-- ============================================================================
-- 4. Storage: public logos/assets under {workspace_id}/...
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('workspace-assets', 'workspace-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Workspace Members Upload Assets" ON storage.objects;
CREATE POLICY "Workspace Members Upload Assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'workspace-assets'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "Workspace Members Update Assets" ON storage.objects;
CREATE POLICY "Workspace Members Update Assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'workspace-assets'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "Workspace Members Delete Assets" ON storage.objects;
CREATE POLICY "Workspace Members Delete Assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'workspace-assets'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "Public Workspace Assets Access" ON storage.objects;
CREATE POLICY "Public Workspace Assets Access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'workspace-assets');
