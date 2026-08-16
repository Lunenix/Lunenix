-- Phase 7: Email Template Management System
-- Extends the existing email_templates + email_settings tables and adds a
-- scheduled_emails table for "send later" manual sends.
--
-- Apply this manually in the Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- 1. Extend email_templates
--    - is_system_default: seeded templates used by workflow triggers. They are
--      editable but must NOT be deletable (enforced in the API + a trigger).
--    - template_key: stable identifier for a system trigger template
--      (e.g. 'invoice_sent'). Unique per workspace when present.
-- ---------------------------------------------------------------------------
ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS is_system_default boolean NOT NULL DEFAULT false;

ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS template_key text;

-- Only one template per (workspace, template_key) when a key is set.
CREATE UNIQUE INDEX IF NOT EXISTS email_templates_workspace_key_uidx
  ON public.email_templates (workspace_id, template_key)
  WHERE template_key IS NOT NULL;

-- Hard guard against deleting a system-default template at the DB level.
CREATE OR REPLACE FUNCTION public.prevent_system_template_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_system_default THEN
    RAISE EXCEPTION 'System default templates cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_system_template_delete ON public.email_templates;
CREATE TRIGGER trg_prevent_system_template_delete
  BEFORE DELETE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.prevent_system_template_delete();

-- ---------------------------------------------------------------------------
-- 2. Extend email_settings with a default signature + a scheduler/booking URL.
--    - signature_html: rich-text default signature appended to manual sends.
--    - scheduler_url: external booking link (e.g. Calendly) that the
--      {{scheduler.link}} smart field resolves to.
-- ---------------------------------------------------------------------------
ALTER TABLE public.email_settings
  ADD COLUMN IF NOT EXISTS signature_html text;

ALTER TABLE public.email_settings
  ADD COLUMN IF NOT EXISTS scheduler_url text;

-- ---------------------------------------------------------------------------
-- 3. scheduled_emails: manual sends queued for a future time.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scheduled_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,
  to_email text NOT NULL,
  to_name text,
  subject text NOT NULL,
  body_html text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'sent', 'failed', 'cancelled')),
  error text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS scheduled_emails_workspace_idx
  ON public.scheduled_emails (workspace_id);
CREATE INDEX IF NOT EXISTS scheduled_emails_due_idx
  ON public.scheduled_emails (status, scheduled_for);

ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view scheduled emails in their workspaces"
  ON public.scheduled_emails FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert scheduled emails in their workspaces"
  ON public.scheduled_emails FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update scheduled emails in their workspaces"
  ON public.scheduled_emails FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete scheduled emails in their workspaces"
  ON public.scheduled_emails FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );
