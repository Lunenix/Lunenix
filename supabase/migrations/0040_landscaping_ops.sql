-- Landscaping & Lawn Care: recurring plans, HOA vs city permits, route order.
-- Landscaping automations seed only for industry_preset = landscaping_lawn_care.

ALTER TABLE public.job_permits
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'city';

ALTER TABLE public.job_permits DROP CONSTRAINT IF EXISTS job_permits_kind_check;
ALTER TABLE public.job_permits
  ADD CONSTRAINT job_permits_kind_check
  CHECK (kind IN ('city', 'hoa', 'other'));

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS route_position INTEGER;

CREATE TABLE IF NOT EXISTS public.service_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'weekly'
    CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'seasonal')),
  seasonal_on BOOLEAN NOT NULL DEFAULT true,
  next_visit_on DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  auto_invoice BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_generated_on DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.service_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_service_plans ON public.service_plans;
CREATE POLICY workspace_members_service_plans ON public.service_plans
  FOR ALL
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

CREATE INDEX IF NOT EXISTS service_plans_workspace_next
  ON public.service_plans (workspace_id, is_active, next_visit_on);

CREATE OR REPLACE FUNCTION seed_landscaping_service_workflows(p_workspace_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  sid UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = p_workspace_id AND w.industry_preset = 'landscaping_lawn_care'
  ) THEN
    RETURN;
  END IF;

  SELECT id INTO sid FROM public.pipeline_stages
    WHERE workspace_id = p_workspace_id AND name = 'Lead'
    ORDER BY position LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO public.automation_workflows (
      workspace_id, name, description, is_active, trigger_type, trigger_config, actions
    )
    SELECT p_workspace_id,
      'Landscaping: New lead',
      'When a new lead is created, capture source and property/service interest.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'New landscaping lead: {{lead.title}}',
          'description', 'Track lead source on the pipeline card. Capture name, phone, email, property address, lot notes, and interest (mow, seasonal, install, irrigation, tree). Email to book an estimate visit. Two-way SMS is not live yet — use email and the contact record.',
          'due_days', 0
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Landscaping: New lead'
    );
  END IF;

  SELECT id INTO sid FROM public.pipeline_stages
    WHERE workspace_id = p_workspace_id AND name = 'Site Visit'
    ORDER BY position LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO public.automation_workflows (
      workspace_id, name, description, is_active, trigger_type, trigger_config, actions
    )
    SELECT p_workspace_id,
      'Landscaping: Schedule estimate visit',
      'On Site Visit, book the estimate and capture property/contact details.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Schedule estimate visit: {{lead.title}}',
          'description', 'Set the estimate time on the calendar with the property address. Confirm access, gate codes, HOA rules, and who will be on site. Save property notes on the contact.',
          'due_days', 1
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Landscaping: Schedule estimate visit'
    );
  END IF;

  SELECT id INTO sid FROM public.pipeline_stages
    WHERE workspace_id = p_workspace_id AND name = 'Estimate Sent'
    ORDER BY position LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO public.automation_workflows (
      workspace_id, name, description, is_active, trigger_type, trigger_config, actions
    )
    SELECT p_workspace_id,
      'Landscaping: Property photos and estimate',
      'On Estimate Sent, attach property photos and send the estimate for digital approval.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Upload property photos: {{lead.title}}',
          'description', 'On-site: photo lawn, beds, drainage, and existing hardscape. Attach to the estimate, then price labor, materials, and any permit or HOA fees.',
          'due_days', 0
        )),
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Send estimate for digital accept: {{lead.title}}',
          'description', 'Email the estimate. Track sent / viewed / approved. On approval, convert to a job. Recurring mow plans are set up after contract on Recurring plans.',
          'due_days', 0
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Landscaping: Property photos and estimate'
    );
  END IF;

  SELECT id INTO sid FROM public.pipeline_stages
    WHERE workspace_id = p_workspace_id AND name = 'Contract Signed'
    ORDER BY position LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO public.automation_workflows (
      workspace_id, name, description, is_active, trigger_type, trigger_config, actions
    )
    SELECT p_workspace_id,
      'Landscaping: Job, crew, permits, and plan',
      'After Contract Signed, assign crew, log city/HOA approvals, and set recurring visits.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Create job and assign crew: {{lead.title}}',
          'description', 'Create the job from the approved estimate. Assign a tech. Check availability and certifications (pesticide/herbicide if applying chemicals) on Techs before dispatch. Set route order on Jobs.',
          'due_days', 1
        )),
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'City permit or HOA sign-off: {{lead.title}}',
          'description', 'On Permits, log city/county permits and HOA sign-off when the work qualifies. Mark pulled and approved. If none is required, log not required.',
          'due_days', 1
        )),
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Set recurring service plan: {{lead.title}}',
          'description', 'If this is mow/maintain, open Recurring plans. Set frequency, next visit, seasonal toggle, and auto-invoice.',
          'due_days', 1
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Landscaping: Job, crew, permits, and plan'
    );
  END IF;

  SELECT id INTO sid FROM public.pipeline_stages
    WHERE workspace_id = p_workspace_id AND name = 'In Progress'
    ORDER BY position LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO public.automation_workflows (
      workspace_id, name, description, is_active, trigger_type, trigger_config, actions
    )
    SELECT p_workspace_id,
      'Landscaping: Route, stock, and receipts',
      'When In Progress, order the route, log mileage, stock, and receipts.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Route order and mileage: {{lead.title}}',
          'description', 'Set route order on Jobs. Log mileage for the tax deduction. GPS auto-optimize is not live.',
          'due_days', 0
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Landscaping: Route, stock, and receipts'
    );
  END IF;

  SELECT id INTO sid FROM public.pipeline_stages
    WHERE workspace_id = p_workspace_id AND name = 'Punch List'
    ORDER BY position LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO public.automation_workflows (
      workspace_id, name, description, is_active, trigger_type, trigger_config, actions
    )
    SELECT p_workspace_id,
      'Landscaping: Punch list and weather',
      'On Punch List, finish leftover work and note weather delays.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Punch list and weather delays: {{lead.title}}',
          'description', 'Walk leftover items, get sign-off, and reschedule weather skips. Ask Luna for weather before dispatch.',
          'due_days', 1
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Landscaping: Punch list and weather'
    );
  END IF;

  SELECT id INTO sid FROM public.pipeline_stages
    WHERE workspace_id = p_workspace_id AND name = 'Closed'
    ORDER BY position LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO public.automation_workflows (
      workspace_id, name, description, is_active, trigger_type, trigger_config, actions
    )
    SELECT p_workspace_id,
      'Landscaping: Invoice, AR, books, and reviews',
      'When Closed, invoice, check aging, books, tax set-aside, and reviews.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Invoice and recurring billing: {{lead.title}}',
          'description', 'Invoice the job. Recurring auto-drafts come from Recurring plans. Check AR aging on Field ops.',
          'due_days', 1
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Landscaping: Invoice, AR, books, and reviews'
    );
  END IF;

  INSERT INTO public.automation_workflows (
    workspace_id, name, description, is_active, trigger_type, trigger_config, actions
  )
  SELECT p_workspace_id,
    'Landscaping: After contract signed (e-sign)',
    'When an e-sign contract completes, kick off the job and plan.',
    true, 'contract_signed', '{}'::jsonb,
    jsonb_build_array(
      jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
        'title', 'Kick off landscape job from signed contract',
        'description', 'Create or update the job, assign a crew, start permit/HOA tracking if needed, and add a recurring plan when this is ongoing service.',
        'due_days', 0
      ))
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_workflows aw
    WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Landscaping: After contract signed (e-sign)'
  );

  INSERT INTO public.automation_workflows (
    workspace_id, name, description, is_active, trigger_type, trigger_config, actions
  )
  SELECT p_workspace_id,
    'Landscaping: After invoice sent',
    'When an invoice is sent, follow AR and overdue reminders.',
    true, 'invoice_sent', '{}'::jsonb,
    jsonb_build_array(
      jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
        'title', 'Follow up on invoice payment',
        'description', 'Watch open invoices and aging. Flag permit/HOA delays, weather skips, or negative reviews.',
        'due_days', 3
      ))
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_workflows aw
    WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Landscaping: After invoice sent'
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION seed_pipeline_stages(p_workspace_id UUID, p_preset TEXT)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  stages TEXT[];
  stage  TEXT;
  pos    INT := 1;
  family TEXT;
BEGIN
  family := industry_pipeline_family(p_preset);
  stages := CASE family
    WHEN 'creative' THEN ARRAY['Discovery','Proposal','Onboarding','In Production','Review','Final Delivery','Archived']
    WHEN 'field'    THEN ARRAY['Lead','Site Visit','Estimate Sent','Contract Signed','In Progress','Punch List','Closed']
    WHEN 'event'    THEN ARRAY['Inquiry','Consultation','Proposal Sent','Contract Signed','Planning','Day-Of','Follow-Up']
    WHEN 'wellness' THEN ARRAY['Lead','Consult Booked','Package Selected','In Care','Completed','Follow-Up','Closed']
    ELSE                 ARRAY['Lead','Qualified','Proposal','Negotiation','Won','Lost']
  END;

  FOREACH stage IN ARRAY stages LOOP
    INSERT INTO pipeline_stages (workspace_id, name, position, color)
    VALUES (p_workspace_id, stage, pos, '#6366f1')
    ON CONFLICT DO NOTHING;
    pos := pos + 1;
  END LOOP;

  IF COALESCE(p_preset, '') = 'hvac'
     AND to_regprocedure('seed_field_service_workflows(uuid)') IS NOT NULL THEN
    PERFORM seed_field_service_workflows(p_workspace_id);
  ELSIF COALESCE(p_preset, '') = 'handyman'
     AND to_regprocedure('seed_handyman_service_workflows(uuid)') IS NOT NULL THEN
    PERFORM seed_handyman_service_workflows(p_workspace_id);
  ELSIF COALESCE(p_preset, '') = 'plumbing'
     AND to_regprocedure('seed_plumbing_service_workflows(uuid)') IS NOT NULL THEN
    PERFORM seed_plumbing_service_workflows(p_workspace_id);
  ELSIF COALESCE(p_preset, '') = 'electrician'
     AND to_regprocedure('seed_electrician_service_workflows(uuid)') IS NOT NULL THEN
    PERFORM seed_electrician_service_workflows(p_workspace_id);
  ELSIF COALESCE(p_preset, '') = 'landscaping_lawn_care' THEN
    PERFORM seed_landscaping_service_workflows(p_workspace_id);
  END IF;

  IF family = 'field' AND to_regprocedure('seed_field_permit_workflows(uuid)') IS NOT NULL THEN
    PERFORM seed_field_permit_workflows(p_workspace_id);
  END IF;
END;
$fn$;

SELECT seed_landscaping_service_workflows(id)
FROM public.workspaces
WHERE industry_preset = 'landscaping_lawn_care';

DELETE FROM public.automation_workflows aw
USING public.workspaces w
WHERE aw.workspace_id = w.id
  AND aw.name LIKE 'Landscaping:%'
  AND COALESCE(w.industry_preset, '') <> 'landscaping_lawn_care';
