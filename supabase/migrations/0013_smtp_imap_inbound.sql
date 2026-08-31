-- Phase 7: Per-workspace SMTP sending + IMAP inbound email
--
-- Extends email_settings so each workspace can (optionally) send through its
-- OWN mail account via SMTP (e.g. Gmail, Outlook, custom host) instead of the
-- shared Resend account, and receive email into an in-app inbox via IMAP.
--
-- Passwords are stored ENCRYPTED (AES-256-GCM) — never in plaintext. They are
-- written by the server (service role) and never returned to the client.

-- ── Extend email_settings ───────────────────────────────────────────────
ALTER TABLE public.email_settings
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'resend'
    CHECK (provider IN ('resend', 'smtp')),
  -- Outgoing (SMTP)
  ADD COLUMN IF NOT EXISTS smtp_host TEXT,
  ADD COLUMN IF NOT EXISTS smtp_port INTEGER,
  ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS smtp_username TEXT,
  ADD COLUMN IF NOT EXISTS smtp_password_enc TEXT,
  -- Incoming (IMAP)
  ADD COLUMN IF NOT EXISTS imap_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS imap_host TEXT,
  ADD COLUMN IF NOT EXISTS imap_port INTEGER,
  ADD COLUMN IF NOT EXISTS imap_secure BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS imap_username TEXT,
  ADD COLUMN IF NOT EXISTS imap_password_enc TEXT,
  ADD COLUMN IF NOT EXISTS imap_last_uid BIGINT,
  ADD COLUMN IF NOT EXISTS imap_last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS imap_last_error TEXT;

-- from_email / from_name were NOT NULL in 0007. With SMTP-only setups the user
-- may not fill these before configuring SMTP, so relax the constraint.
ALTER TABLE public.email_settings ALTER COLUMN from_email DROP NOT NULL;
ALTER TABLE public.email_settings ALTER COLUMN from_name DROP NOT NULL;

-- ── Inbound emails (in-app inbox) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inbound_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  message_id TEXT,                    -- RFC Message-ID header (dedupe)
  imap_uid BIGINT,                    -- IMAP UID it was fetched at
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_inbound_emails_workspace ON public.inbound_emails(workspace_id);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_contact ON public.inbound_emails(contact_id);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_received ON public.inbound_emails(received_at DESC);

ALTER TABLE public.inbound_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view inbound emails in their workspaces"
  ON public.inbound_emails FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update inbound emails in their workspaces"
  ON public.inbound_emails FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete inbound emails in their workspaces"
  ON public.inbound_emails FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );
-- Inserts happen server-side via the service role (bypasses RLS).
