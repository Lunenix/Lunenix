-- Phase 5: Forms & Questionnaires Migration
-- Description: Creates forms and form_submissions tables with RLS policies

-- ============================================
-- FORMS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  -- Form details
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  
  -- Form fields configuration (JSONB array)
  -- Each field: {id: string, type: string, label: string, placeholder?: string, required: boolean, options?: string[]}
  -- Field types: text, textarea, email, phone, number, date, select, radio, checkbox
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Settings
  submit_button_text TEXT DEFAULT 'Submit',
  success_message TEXT DEFAULT 'Thank you for your submission!',
  allow_multiple_submissions BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_forms_workspace ON public.forms(workspace_id);
CREATE INDEX IF NOT EXISTS idx_forms_status ON public.forms(status);

-- Enable RLS
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;

-- RLS Policies for forms
CREATE POLICY "Users can view forms in their workspaces"
  ON public.forms FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert forms in their workspaces"
  ON public.forms FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update forms in their workspaces"
  ON public.forms FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete forms in their workspaces"
  ON public.forms FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- FORM SUBMISSIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  
  -- Submission data (JSONB object)
  -- Key-value pairs matching field IDs to submitted values
  -- Example: {"field_1": "John Doe", "field_2": "john@example.com", "field_3": "555-1234"}
  submitted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Metadata
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  
  -- Auto-generated contact info
  auto_created_contact BOOLEAN DEFAULT false
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_submissions_form ON public.form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_submissions_workspace ON public.form_submissions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_submissions_contact ON public.form_submissions(contact_id);
CREATE INDEX IF NOT EXISTS idx_submissions_date ON public.form_submissions(submitted_at);

-- Enable RLS
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for form_submissions
CREATE POLICY "Users can view submissions in their workspaces"
  ON public.form_submissions FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- Note: INSERT policy is handled separately in the public submission API endpoint
-- using service role key to bypass RLS for public form submissions

CREATE POLICY "Users can delete submissions in their workspaces"
  ON public.form_submissions FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger to auto-update updated_at for forms
CREATE OR REPLACE FUNCTION update_forms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER forms_updated_at
  BEFORE UPDATE ON public.forms
  FOR EACH ROW
  EXECUTE FUNCTION update_forms_updated_at();
