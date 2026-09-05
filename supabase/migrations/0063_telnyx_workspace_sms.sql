-- Telnyx 10DLC per workspace. Recreate SMS settings dropped in 0062.
-- Isolated table. Do not recreate contacts/invoices/tasks/projects.

CREATE TABLE IF NOT EXISTS public.workspace_sms_settings (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  from_e164 text UNIQUE,
  telnyx_number_id text,
  area_code text,
  enabled boolean NOT NULL DEFAULT true,
  provision_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_sms_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_workspace_sms_settings
  ON public.workspace_sms_settings;
CREATE POLICY workspace_members_workspace_sms_settings
  ON public.workspace_sms_settings FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS workspace_sms_settings_updated_at ON public.workspace_sms_settings;
CREATE TRIGGER workspace_sms_settings_updated_at
  BEFORE UPDATE ON public.workspace_sms_settings
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE INDEX IF NOT EXISTS workspace_sms_settings_from
  ON public.workspace_sms_settings (from_e164)
  WHERE from_e164 IS NOT NULL;

ALTER TABLE public.sms_threads
  ADD COLUMN IF NOT EXISTS contact_phone text;

ALTER TABLE public.sms_messages
  ADD COLUMN IF NOT EXISTS sent_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS sms_opt_in_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS sms_threads_workspace_contact_phone
  ON public.sms_threads (workspace_id, contact_phone)
  WHERE contact_phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS sms_messages_workspace_created
  ON public.sms_messages (workspace_id, created_at DESC);

DO $realtime$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_threads;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_messages;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END
$realtime$;
