-- Phase 6: Emails & Automation Migration
-- Description: Creates email_templates, email_logs, automation_workflows, and automation_logs tables with RLS policies

-- ============================================
-- EMAIL TEMPLATES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  -- Template details
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL, -- HTML content
  
  -- Available variables (JSONB array)
  -- Each variable: {key: string, label: string, description: string}
  -- Example: [{key: "contact.name", label: "Contact Name", description: "The contact's full name"}]
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_email_templates_workspace ON public.email_templates(workspace_id);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_templates
CREATE POLICY "Users can view email templates in their workspaces"
  ON public.email_templates FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert email templates in their workspaces"
  ON public.email_templates FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update email templates in their workspaces"
  ON public.email_templates FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete email templates in their workspaces"
  ON public.email_templates FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- EMAIL LOGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  
  -- Email details
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL, -- HTML content
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  
  -- Metadata
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_email_logs_workspace ON public.email_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_contact ON public.email_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_template ON public.email_logs(template_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON public.email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs(status);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_logs
CREATE POLICY "Users can view email logs in their workspaces"
  ON public.email_logs FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert email logs in their workspaces"
  ON public.email_logs FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete email logs in their workspaces"
  ON public.email_logs FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- AUTOMATION WORKFLOWS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.automation_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  -- Workflow details
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT false,
  
  -- Trigger configuration
  -- Trigger types: form_submission, lead_stage_change, contact_created, task_completed, etc.
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'form_submission',
    'lead_stage_change',
    'contact_created',
    'task_completed',
    'invoice_sent',
    'contract_signed'
  )),
  
  -- Trigger-specific configuration (JSONB object)
  -- Example for form_submission: {form_id: "uuid"}
  -- Example for lead_stage_change: {from_stage_id: "uuid", to_stage_id: "uuid"}
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Actions to perform (JSONB array)
  -- Each action: {type: string, config: object}
  -- Action types: send_email, create_task, update_contact, move_lead, delay, etc.
  -- Example: [
  --   {type: "send_email", config: {template_id: "uuid", to: "{{contact.email}}"}},
  --   {type: "create_task", config: {title: "Follow up with {{contact.name}}", due_days: 3}}
  -- ]
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_automation_workflows_workspace ON public.automation_workflows(workspace_id);
CREATE INDEX IF NOT EXISTS idx_automation_workflows_trigger ON public.automation_workflows(trigger_type);
CREATE INDEX IF NOT EXISTS idx_automation_workflows_active ON public.automation_workflows(is_active);

-- Enable RLS
ALTER TABLE public.automation_workflows ENABLE ROW LEVEL SECURITY;

-- RLS Policies for automation_workflows
CREATE POLICY "Users can view automation workflows in their workspaces"
  ON public.automation_workflows FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert automation workflows in their workspaces"
  ON public.automation_workflows FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update automation workflows in their workspaces"
  ON public.automation_workflows FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete automation workflows in their workspaces"
  ON public.automation_workflows FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- AUTOMATION LOGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.automation_workflows(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  -- Execution details
  trigger_data JSONB NOT NULL DEFAULT '{}'::jsonb, -- Data that triggered the workflow
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'partial')),
  error_message TEXT,
  
  -- Action results (JSONB array)
  -- Each result: {action_type: string, status: string, error?: string}
  action_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Metadata
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_automation_logs_workflow ON public.automation_logs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_workspace ON public.automation_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_executed_at ON public.automation_logs(executed_at);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON public.automation_logs(status);

-- Enable RLS
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for automation_logs
CREATE POLICY "Users can view automation logs in their workspaces"
  ON public.automation_logs FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert automation logs in their workspaces"
  ON public.automation_logs FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger to auto-update updated_at for email_templates
CREATE OR REPLACE FUNCTION update_email_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_email_templates_updated_at();

-- Trigger to auto-update updated_at for automation_workflows
CREATE OR REPLACE FUNCTION update_automation_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER automation_workflows_updated_at
  BEFORE UPDATE ON public.automation_workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_automation_workflows_updated_at();
