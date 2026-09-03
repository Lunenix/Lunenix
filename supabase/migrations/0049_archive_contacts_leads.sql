-- Archive contacts and pipeline leads without deleting them.
-- Default lists hide rows where archived_at is set.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS contacts_workspace_archived_idx
  ON public.contacts (workspace_id, archived_at);

CREATE INDEX IF NOT EXISTS leads_workspace_archived_idx
  ON public.leads (workspace_id, archived_at);
