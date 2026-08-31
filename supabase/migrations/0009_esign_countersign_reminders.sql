-- Phase 9: E-Signature — Countersigning, Sub-Agreement Cloning & Reminders
-- Adds reminder tracking, clone lineage, and the 'reminded' audit event.
-- Countersigning reuses the existing 'countersigned' status + owner-assigned
-- fields, so no new columns are required for it beyond what 0008 created.

-- ============================================
-- Reminder tracking + clone lineage
-- ============================================
ALTER TABLE public.esign_documents
  ADD COLUMN IF NOT EXISTS reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS reminder_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cloned_from UUID
    REFERENCES public.esign_documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_esign_docs_reminder_scan
  ON public.esign_documents(status, reminders_enabled);

-- ============================================
-- Allow the 'reminded' event type in the audit trail
-- ============================================
ALTER TABLE public.esign_events
  DROP CONSTRAINT IF EXISTS esign_events_event_type_check;

ALTER TABLE public.esign_events
  ADD CONSTRAINT esign_events_event_type_check
  CHECK (event_type IN (
    'created', 'sent', 'viewed', 'signed', 'countersigned',
    'void', 'downloaded', 'reminded'
  ));
