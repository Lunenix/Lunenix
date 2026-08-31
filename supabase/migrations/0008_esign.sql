-- Phase 8: E-Signature Module (DocuSign-style)
-- Description: Upload a PDF, place signature/initials/date/text fields on it,
-- send a tokenized public signing link, capture signatures, generate an
-- immutable signed PDF with audit trail, and fire the contract_signed
-- automation trigger.

-- ============================================
-- ESIGN_DOCUMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.esign_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,

  -- Document meta
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'contract' CHECK (type IN ('contract', 'sub_agreement')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'viewed', 'signed', 'countersigned', 'void')),

  -- Storage
  original_file_path TEXT,        -- path in the private `contracts` bucket
  signed_file_path TEXT,          -- generated, immutable signed PDF
  page_count INTEGER DEFAULT 1,

  -- Public signing
  sign_token TEXT UNIQUE,
  signer_name TEXT,
  signer_email TEXT,

  -- Automation
  assigned_workflow_id UUID REFERENCES public.automation_workflows(id) ON DELETE SET NULL,

  -- Lifecycle timestamps
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  countersigned_at TIMESTAMPTZ,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_esign_docs_workspace ON public.esign_documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_esign_docs_project ON public.esign_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_esign_docs_contact ON public.esign_documents(contact_id);
CREATE INDEX IF NOT EXISTS idx_esign_docs_status ON public.esign_documents(status);
CREATE INDEX IF NOT EXISTS idx_esign_docs_token ON public.esign_documents(sign_token);

-- Enforce max one primary 'contract' per project (sub_agreements unlimited).
-- Voided documents are excluded so a project can be re-contracted.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_esign_primary_contract_per_project
  ON public.esign_documents(project_id)
  WHERE type = 'contract' AND status <> 'void' AND project_id IS NOT NULL;

ALTER TABLE public.esign_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view esign_documents in their workspaces"
  ON public.esign_documents FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert esign_documents in their workspaces"
  ON public.esign_documents FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update esign_documents in their workspaces"
  ON public.esign_documents FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete esign_documents in their workspaces"
  ON public.esign_documents FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));

-- ============================================
-- ESIGN_FIELDS TABLE
-- ============================================
-- Field positions are stored as NORMALIZED floats (0..1) relative to page
-- width/height, so they are resolution-independent.

CREATE TABLE IF NOT EXISTS public.esign_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.esign_documents(id) ON DELETE CASCADE,

  page INTEGER NOT NULL DEFAULT 0,
  field_type TEXT NOT NULL
    CHECK (field_type IN ('signature', 'initials', 'date', 'text', 'name')),

  -- Normalized geometry (0..1), origin top-left of the page.
  pos_x DOUBLE PRECISION NOT NULL,
  pos_y DOUBLE PRECISION NOT NULL,
  width DOUBLE PRECISION NOT NULL,
  height DOUBLE PRECISION NOT NULL,

  assigned_to TEXT NOT NULL DEFAULT 'client' CHECK (assigned_to IN ('client', 'owner')),
  required BOOLEAN NOT NULL DEFAULT TRUE,
  placeholder TEXT,
  value TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_esign_fields_document ON public.esign_fields(document_id);

ALTER TABLE public.esign_fields ENABLE ROW LEVEL SECURITY;

-- Access is scoped through the parent document's workspace membership.
CREATE POLICY "Users can view esign_fields in their workspaces"
  ON public.esign_fields FOR SELECT
  USING (document_id IN (
    SELECT id FROM public.esign_documents WHERE workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can insert esign_fields in their workspaces"
  ON public.esign_fields FOR INSERT
  WITH CHECK (document_id IN (
    SELECT id FROM public.esign_documents WHERE workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can update esign_fields in their workspaces"
  ON public.esign_fields FOR UPDATE
  USING (document_id IN (
    SELECT id FROM public.esign_documents WHERE workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can delete esign_fields in their workspaces"
  ON public.esign_fields FOR DELETE
  USING (document_id IN (
    SELECT id FROM public.esign_documents WHERE workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  ));

-- ============================================
-- ESIGN_SIGNATURES TABLE (immutable)
-- ============================================

CREATE TABLE IF NOT EXISTS public.esign_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.esign_documents(id) ON DELETE CASCADE,

  signer_name TEXT NOT NULL,
  signer_email TEXT,
  signature_type TEXT NOT NULL CHECK (signature_type IN ('typed', 'drawn')),
  signature_data TEXT NOT NULL,   -- base64 PNG (drawn) or the typed string
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'owner')),

  ip_address TEXT,
  user_agent TEXT,
  signed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_esign_signatures_document ON public.esign_signatures(document_id);

ALTER TABLE public.esign_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view esign_signatures in their workspaces"
  ON public.esign_signatures FOR SELECT
  USING (document_id IN (
    SELECT id FROM public.esign_documents WHERE workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  ));

-- ============================================
-- ESIGN_EVENTS TABLE (audit trail)
-- ============================================

CREATE TABLE IF NOT EXISTS public.esign_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.esign_documents(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL
    CHECK (event_type IN ('created', 'sent', 'viewed', 'signed', 'countersigned', 'void', 'downloaded')),
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_esign_events_document ON public.esign_events(document_id);

ALTER TABLE public.esign_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view esign_events in their workspaces"
  ON public.esign_events FOR SELECT
  USING (document_id IN (
    SELECT id FROM public.esign_documents WHERE workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  ));

-- ============================================
-- TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_esign_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS esign_documents_updated_at ON public.esign_documents;
CREATE TRIGGER esign_documents_updated_at
  BEFORE UPDATE ON public.esign_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_esign_documents_updated_at();

-- ============================================
-- STORAGE BUCKET (private)
-- ============================================
-- Bucket is created via a service-role script, but ensure it exists here too.
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;
