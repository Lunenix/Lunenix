-- Hub scheduling + two-way SMS for every workspace.
-- Isolated tables. Do not recreate contacts/invoices/tasks/projects.

CREATE TABLE IF NOT EXISTS public.schedule_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  location text,
  notes text,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('requested', 'scheduled', 'confirmed', 'cancelled', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_sms_settings (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  from_e164 text UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sms_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  contact_phone text NOT NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, contact_phone)
);

CREATE TABLE IF NOT EXISTS public.sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES public.sms_threads(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body text NOT NULL,
  provider_sid text,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $policies$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'schedule_events',
    'workspace_sms_settings',
    'sms_threads',
    'sms_messages'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS workspace_members_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY workspace_members_%I ON public.%I FOR ALL
        USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()))
        WITH CHECK (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()))',
      t, t
    );
  END LOOP;
END
$policies$;

CREATE INDEX IF NOT EXISTS schedule_events_workspace_starts
  ON public.schedule_events (workspace_id, starts_at);
CREATE INDEX IF NOT EXISTS sms_threads_workspace_last
  ON public.sms_threads (workspace_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS sms_messages_thread_created
  ON public.sms_messages (thread_id, created_at);
CREATE INDEX IF NOT EXISTS workspace_sms_settings_from
  ON public.workspace_sms_settings (from_e164)
  WHERE from_e164 IS NOT NULL;

DROP TRIGGER IF EXISTS schedule_events_updated_at ON public.schedule_events;
CREATE TRIGGER schedule_events_updated_at BEFORE UPDATE ON public.schedule_events
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS workspace_sms_settings_updated_at ON public.workspace_sms_settings;
CREATE TRIGGER workspace_sms_settings_updated_at BEFORE UPDATE ON public.workspace_sms_settings
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
