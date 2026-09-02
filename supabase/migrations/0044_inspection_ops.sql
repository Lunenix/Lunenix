-- Inspection Services: findings, reports, specialty add-ons, inspector E&O/CE,
-- job inspection phase / closing date, equipment calibration date.
-- Automations seed only for industry_preset = inspection_service.
-- Inspectors do not get the shared Field: permit pair.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS inspection_phase TEXT;
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS closing_on DATE;

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_inspection_phase_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_inspection_phase_check
    CHECK (
      inspection_phase IS NULL OR inspection_phase IN (
        'scheduled', 'in_progress', 'report_pending', 'delivered'
      )
    );

ALTER TABLE public.technician_profiles
  ADD COLUMN IF NOT EXISTS eo_expires DATE;
ALTER TABLE public.technician_profiles
  ADD COLUMN IF NOT EXISTS ce_due_on DATE;

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS calibrated_on DATE;

ALTER TABLE public.estimate_photos DROP CONSTRAINT IF EXISTS estimate_photos_kind_check;
ALTER TABLE public.estimate_photos
  ADD CONSTRAINT estimate_photos_kind_check
    CHECK (kind IN (
      'photo', 'drone', 'measurement', 'video', 'surface', 'swatch', 'prep',
      'infestation', 'entry_point', 'finding', 'thermal', 'moisture'
    ));

CREATE TABLE IF NOT EXISTS public.inspection_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  system TEXT NOT NULL DEFAULT 'other'
    CHECK (system IN (
      'roof', 'hvac', 'electrical', 'plumbing', 'foundation',
      'appliances', 'interior', 'exterior', 'other'
    )),
  title TEXT NOT NULL,
  notes TEXT,
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('safety', 'major', 'minor', 'cosmetic', 'info')),
  moisture_reading TEXT,
  thermal_notes TEXT,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'noted', 'included_in_report')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inspection_findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_inspection_findings ON public.inspection_findings;
CREATE POLICY workspace_members_inspection_findings ON public.inspection_findings
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

CREATE INDEX IF NOT EXISTS inspection_findings_workspace
  ON public.inspection_findings (workspace_id, project_id, severity);

CREATE TABLE IF NOT EXISTS public.inspection_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary TEXT,
  agent_name TEXT,
  seller_agent_name TEXT,
  property_type TEXT,
  property_size TEXT,
  closing_on DATE,
  due_at DATE,
  walkthrough_at TIMESTAMPTZ,
  share_token UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'sent', 'viewed', 'downloaded')),
  ready_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  downloaded_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (share_token)
);

ALTER TABLE public.inspection_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_inspection_reports ON public.inspection_reports;
CREATE POLICY workspace_members_inspection_reports ON public.inspection_reports
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

CREATE INDEX IF NOT EXISTS inspection_reports_workspace
  ON public.inspection_reports (workspace_id, status);

CREATE TABLE IF NOT EXISTS public.inspection_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'other'
    CHECK (kind IN ('radon', 'mold', 'termite_wdo', 'sewer', 'pool', 'other')),
  status TEXT NOT NULL DEFAULT 'ordered'
    CHECK (status IN ('ordered', 'scheduled', 'in_progress', 'complete', 'cancelled')),
  specialist_name TEXT,
  result_summary TEXT,
  due_on DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inspection_addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_inspection_addons ON public.inspection_addons;
CREATE POLICY workspace_members_inspection_addons ON public.inspection_addons
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

CREATE INDEX IF NOT EXISTS inspection_addons_workspace
  ON public.inspection_addons (workspace_id, status);

CREATE OR REPLACE FUNCTION seed_inspection_service_workflows(p_workspace_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  sid UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = p_workspace_id AND w.industry_preset = 'inspection_service'
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
      'Inspection: New lead',
      'When a new lead is created, capture buyer vs seller vs realtor vs investor.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'New inspection lead: {{lead.title}}',
          'description', 'Set lead source: buyer, seller/pre-listing, realtor referral, or investor. Capture buyer, listing agent, and seller agent names/phones, address, property type/size, and closing date if known. Email to book. Two-way SMS is not live yet.',
          'due_days', 0
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'Thanks for contacting {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>We received your inspection request. Reply with the property address, a few times that work, and the closing date if you have it. Turnaround is often tight near closing.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Inspection: New lead'
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
      'Inspection: Schedule visit',
      'On Site Visit, book the inspection on the calendar with the address.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Schedule inspection: {{lead.title}}',
          'description', 'Confirm date/time, address, buyer + agents, source, property type/size, closing date. Add to the calendar with the address. Send confirmation and a reminder. Mark urgent/rush on Jobs if same-day or closing is close. Two-way texting is not live. GPS auto-route is not live.',
          'due_days', 0
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Inspection: Schedule visit'
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
      'Inspection: Agreement and fee',
      'On Estimate Sent, send the inspection agreement and fee.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Send inspection agreement: {{lead.title}}',
          'description', 'Email the estimate/agreement. Many inspectors collect payment at scheduling or before the report is released. Track sent / viewed / approved. Add-ons (radon, mold, WDO, sewer, pool) go on Add-ons.',
          'due_days', 0
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Inspection: Agreement and fee'
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
      'Inspection: Assign inspector and add-ons',
      'After Contract Signed, assign a licensed inspector and log specialty add-ons.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Assign inspector and check license: {{lead.title}}',
          'description', 'Create the job. Assign an inspector. Confirm state license, E&O, and CE dates on Techs. Set inspection phase scheduled. Set closing date and rush if needed. Do not paste license numbers into Luna chat.',
          'due_days', 0
        )),
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Log specialty add-ons: {{lead.title}}',
          'description', 'On Add-ons, log radon, mold, termite/WDO, sewer scope, or pool if ordered. Coordinate the specialist. Separate results stay on the same job.',
          'due_days', 1
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Inspection: Assign inspector and add-ons'
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
      'Inspection: On-site findings',
      'When In Progress, run the system checklist and capture photos.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Log room and system findings: {{lead.title}}',
          'description', 'On Findings, log roof, HVAC, electrical, plumbing, foundation, and appliances with severity (safety, major, minor, cosmetic). Type notes — voice-to-text is not live. Moisture/thermal fields are on the finding. Upload photos on Estimates (kind finding, thermal, or moisture). Check meter calibration on Inventory. Log mileage. OCR is not auto-filled. GPS auto-track is not live.',
          'due_days', 0
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Inspection: On-site findings'
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
      'Inspection: Report pending',
      'On Punch List, assemble the report and notify client and agent.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Build and send inspection report: {{lead.title}}',
          'description', 'On Reports, build the summary from findings, set due date (often the closing window), mark ready, and email the share link. Track viewed/downloaded. Offer a phone/video walkthrough. Confirm payment before release if that is your policy. Set job phase report pending then delivered.',
          'due_days', 0
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Inspection: Report pending'
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
      'Inspection: Invoice, books, and reviews',
      'When Closed, confirm payment, books, and a review request.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Invoice and books: {{lead.title}}',
          'description', 'Confirm same-day or completion invoice is paid. Check AR aging. Log specialist bills in Books. Mileage is on Mileage. Field ops shows profit and a 30% tax set-aside hint. Save property history on the contact for re-inspections. Flag negative reviews.',
          'due_days', 1
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Inspection: Invoice, books, and reviews'
    );
  END IF;

  INSERT INTO public.automation_workflows (
    workspace_id, name, description, is_active, trigger_type, trigger_config, actions
  )
  SELECT p_workspace_id,
    'Inspection: After contract signed (e-sign)',
    'When an e-sign agreement completes, assign the inspector.',
    true, 'contract_signed', '{}'::jsonb,
    jsonb_build_array(
      jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
        'title', 'Kick off inspection from signed agreement',
        'description', 'Create or update the job, assign an inspector, log add-ons, and put the visit on the calendar.',
        'due_days', 0
      ))
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_workflows aw
    WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Inspection: After contract signed (e-sign)'
  );

  INSERT INTO public.automation_workflows (
    workspace_id, name, description, is_active, trigger_type, trigger_config, actions
  )
  SELECT p_workspace_id,
    'Inspection: After invoice sent',
    'When an invoice is sent, follow AR — often before report release.',
    true, 'invoice_sent', '{}'::jsonb,
    jsonb_build_array(
      jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
        'title', 'Follow up on inspection payment',
        'description', 'Watch aging. Many offices hold the report until paid. Flag reports past due, license/E&O/CE renewals, or negative reviews.',
        'due_days', 2
      ))
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_workflows aw
    WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Inspection: After invoice sent'
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
  ELSIF COALESCE(p_preset, '') = 'roofing_exterior_repair' THEN
    PERFORM seed_roofing_service_workflows(p_workspace_id);
  ELSIF COALESCE(p_preset, '') = 'painting_drywall' THEN
    PERFORM seed_painting_service_workflows(p_workspace_id);
  ELSIF COALESCE(p_preset, '') = 'pest_control' THEN
    PERFORM seed_pest_service_workflows(p_workspace_id);
  ELSIF COALESCE(p_preset, '') = 'inspection_service' THEN
    PERFORM seed_inspection_service_workflows(p_workspace_id);
  END IF;

  IF family = 'field'
     AND COALESCE(p_preset, '') NOT IN ('cleaning_services', 'inspection_service')
     AND to_regprocedure('seed_field_permit_workflows(uuid)') IS NOT NULL THEN
    PERFORM seed_field_permit_workflows(p_workspace_id);
  END IF;
END;
$fn$;

SELECT seed_inspection_service_workflows(id)
FROM public.workspaces
WHERE industry_preset = 'inspection_service';

DELETE FROM public.automation_workflows aw
USING public.workspaces w
WHERE aw.workspace_id = w.id
  AND aw.name LIKE 'Inspection:%'
  AND COALESCE(w.industry_preset, '') <> 'inspection_service';
