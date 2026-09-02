-- General Contractors & Construction: change orders, subs, phases, daily logs, draws.
-- Fold legacy general_contractor workspaces into contractors_construction.
-- Automations seed only for that preset. Shared Field: permits stay on.

UPDATE public.workspaces
SET industry_preset = 'contractors_construction'
WHERE industry_preset = 'general_contractor';

ALTER TABLE public.estimate_photos DROP CONSTRAINT IF EXISTS estimate_photos_kind_check;
ALTER TABLE public.estimate_photos
  ADD CONSTRAINT estimate_photos_kind_check
    CHECK (kind IN (
      'photo', 'drone', 'measurement', 'video', 'surface', 'swatch', 'prep',
      'infestation', 'entry_point', 'finding', 'thermal', 'moisture',
      'progress', 'existing', 'concealed'
    ));

ALTER TABLE public.job_permits DROP CONSTRAINT IF EXISTS job_permits_kind_check;
ALTER TABLE public.job_permits
  ADD CONSTRAINT job_permits_kind_check
    CHECK (kind IN (
      'city', 'hoa', 'building', 'electrical', 'plumbing', 'mechanical', 'other'
    ));

ALTER TABLE public.material_orders DROP CONSTRAINT IF EXISTS material_orders_material_type_check;
ALTER TABLE public.material_orders
  ADD CONSTRAINT material_orders_material_type_check
    CHECK (material_type IN (
      'shingles', 'underlayment', 'dumpster', 'paint', 'primer',
      'drywall', 'compound', 'chemical', 'bait', 'trap',
      'lumber', 'concrete', 'fixture', 'other'
    ));

CREATE TABLE IF NOT EXISTS public.construction_change_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'approved', 'rejected')),
  cost_impact NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.construction_change_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_construction_change_orders ON public.construction_change_orders;
CREATE POLICY workspace_members_construction_change_orders ON public.construction_change_orders
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

CREATE INDEX IF NOT EXISTS construction_change_orders_workspace
  ON public.construction_change_orders (workspace_id, status);

CREATE TABLE IF NOT EXISTS public.construction_subs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trade TEXT NOT NULL DEFAULT 'other'
    CHECK (trade IN (
      'electrical', 'plumbing', 'hvac', 'concrete', 'framing', 'roofing', 'other'
    )),
  phone TEXT,
  email TEXT,
  coi_expires DATE,
  license_expires DATE,
  rate_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.construction_subs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_construction_subs ON public.construction_subs;
CREATE POLICY workspace_members_construction_subs ON public.construction_subs
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

CREATE INDEX IF NOT EXISTS construction_subs_workspace
  ON public.construction_subs (workspace_id, trade);

CREATE TABLE IF NOT EXISTS public.construction_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  sub_id UUID REFERENCES public.construction_subs(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'finish'
    CHECK (kind IN (
      'demo', 'foundation', 'framing', 'rough_in', 'drywall', 'finish'
    )),
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'delayed', 'complete')),
  percent_complete NUMERIC NOT NULL DEFAULT 0,
  delay_cause TEXT
    CHECK (delay_cause IS NULL OR delay_cause IN (
      'weather', 'permit', 'material', 'sub_no_show', 'other'
    )),
  depends_on TEXT,
  starts_on DATE,
  ends_on DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.construction_phases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_construction_phases ON public.construction_phases;
CREATE POLICY workspace_members_construction_phases ON public.construction_phases
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

CREATE INDEX IF NOT EXISTS construction_phases_workspace
  ON public.construction_phases (workspace_id, status);

CREATE TABLE IF NOT EXISTS public.construction_daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  logged_on DATE NOT NULL DEFAULT (CURRENT_DATE),
  weather TEXT,
  crew_notes TEXT,
  work_completed TEXT,
  issues TEXT,
  safety_notes TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.construction_daily_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_construction_daily_logs ON public.construction_daily_logs;
CREATE POLICY workspace_members_construction_daily_logs ON public.construction_daily_logs
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

CREATE INDEX IF NOT EXISTS construction_daily_logs_workspace
  ON public.construction_daily_logs (workspace_id, logged_on);

CREATE TABLE IF NOT EXISTS public.construction_draws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'progress'
    CHECK (kind IN ('deposit', 'progress', 'retainage')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'paid')),
  amount NUMERIC NOT NULL DEFAULT 0,
  percent_complete NUMERIC NOT NULL DEFAULT 0,
  due_on DATE,
  lien_waiver TEXT NOT NULL DEFAULT 'needed'
    CHECK (lien_waiver IN ('needed', 'received', 'not_required')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.construction_draws ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_construction_draws ON public.construction_draws;
CREATE POLICY workspace_members_construction_draws ON public.construction_draws
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

CREATE INDEX IF NOT EXISTS construction_draws_workspace
  ON public.construction_draws (workspace_id, status);

CREATE OR REPLACE FUNCTION seed_construction_workflows(p_workspace_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  sid UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = p_workspace_id AND w.industry_preset = 'contractors_construction'
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
      'Build: New lead',
      'When a new lead is created, capture referral vs bid invite vs repeat vs project type.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'New construction lead: {{lead.title}}',
          'description', 'Set lead source: referral, bid invite, repeat client, remodel, addition, or new build. Capture name, phone, email, address, scope, and budget range. Email to book a site visit. Two-way SMS is not live yet.',
          'due_days', 0
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'Thanks for contacting {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>We received your project inquiry. Reply with the address, a few visit times, and a short scope or budget range.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Build: New lead'
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
      'Build: Schedule site visit',
      'On Site Visit, book the consultation on the calendar with the address.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Schedule site visit: {{lead.title}}',
          'description', 'Confirm date/time, address, source, scope, budget range. Add to the calendar with the address. Send confirmation and a reminder. Two-way texting is not live. GPS auto-route is not live.',
          'due_days', 0
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'Your site visit is booked — {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>We have you on the calendar for a site visit. Reply to this email if the time or address changes.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Build: Schedule site visit'
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
      'Build: Bid and estimate',
      'On Estimate Sent, send a line-item bid (labor, materials, subs, margin).',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Send bid: {{lead.title}}',
          'description', 'On Estimates, build labor/materials/subs line items and margin. Upload existing-condition photos (kind existing or measurement). Email the bid. Approval creates the job.',
          'due_days', 0
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'Your bid from {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>Your bid is ready. Please review the line items and reply to approve. We will send a contract next.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Build: Bid and estimate'
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
      'Build: Contract, permits, and phases',
      'After Contract Signed, e-sign the contract, log permits, and set the phase schedule.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Contract and kickoff: {{lead.title}}',
          'description', 'Send the e-sign contract (scope, payment schedule, timeline). On Permits, log building/electrical/plumbing/mechanical as needed. On Phases, set demo through finish. On Draws, log the deposit. Check sub COIs on Subs. Do not paste license numbers into Luna.',
          'due_days', 0
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'Next steps after signing — {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>Thanks for signing. We will pull permits, lock the phase schedule, and send the deposit draw.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Build: Contract, permits, and phases'
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
      'Build: Active job',
      'When In Progress, run daily logs, subs, materials, and change orders.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Run the job: {{lead.title}}',
          'description', 'On Daily logs, record weather, crew, work completed, and safety. Upload progress and before-covering photos on Estimates. Assign subs per phase. Order materials by phase. Change orders must be approved before extra work. OCR is not auto-filled. GPS auto-track is not live.',
          'due_days', 0
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Build: Active job'
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
      'Build: Punch and inspections',
      'On Punch List, finish inspections and punch/warranty items.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Punch list and final inspections: {{lead.title}}',
          'description', 'On Permits, confirm inspections passed. Walk punch items on the job. Keep warranty notes on the contact. Collect remaining lien waivers on Draws.',
          'due_days', 0
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Build: Punch and inspections'
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
      'Build: Final draw, books, and margin',
      'When Closed, collect retainage, books, and project margin.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Close-out draw and books: {{lead.title}}',
          'description', 'Invoice retainage. Confirm lien waivers. Pay sub bills in Books. Compare budget vs actual and approved change-order impact on Field ops. Flag negative reviews.',
          'due_days', 1
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Build: Final draw, books, and margin'
    );
  END IF;

  INSERT INTO public.automation_workflows (
    workspace_id, name, description, is_active, trigger_type, trigger_config, actions
  )
  SELECT p_workspace_id,
    'Build: After contract signed (e-sign)',
    'When an e-sign contract completes, kick off permits and phases.',
    true, 'contract_signed', '{}'::jsonb,
    jsonb_build_array(
      jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
        'title', 'Kick off job from signed contract',
        'description', 'Create or update the job, log permits, set phases, assign crew/subs, and send the deposit draw.',
        'due_days', 0
      ))
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_workflows aw
    WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Build: After contract signed (e-sign)'
  );

  INSERT INTO public.automation_workflows (
    workspace_id, name, description, is_active, trigger_type, trigger_config, actions
  )
  SELECT p_workspace_id,
    'Build: After invoice sent',
    'When an invoice or draw is sent, follow AR and lien waivers.',
    true, 'invoice_sent', '{}'::jsonb,
    jsonb_build_array(
      jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
        'title', 'Follow up on draw / invoice',
        'description', 'Watch aging. Confirm lien waiver status on Draws. Flag delayed permits, expired sub COIs, or jobs behind schedule.',
        'due_days', 3
      ))
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_workflows aw
    WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Build: After invoice sent'
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
  ELSIF COALESCE(p_preset, '') = 'rental_company' THEN
    PERFORM seed_rental_company_workflows(p_workspace_id);
  ELSIF COALESCE(p_preset, '') IN ('contractors_construction', 'general_contractor') THEN
    PERFORM seed_construction_workflows(p_workspace_id);
  END IF;

  IF family = 'field'
     AND COALESCE(p_preset, '') NOT IN (
       'cleaning_services', 'inspection_service', 'rental_company'
     )
     AND to_regprocedure('seed_field_permit_workflows(uuid)') IS NOT NULL THEN
    PERFORM seed_field_permit_workflows(p_workspace_id);
  END IF;
END;
$fn$;

SELECT seed_construction_workflows(id)
FROM public.workspaces
WHERE industry_preset IN ('contractors_construction', 'general_contractor');

DELETE FROM public.automation_workflows aw
USING public.workspaces w
WHERE aw.workspace_id = w.id
  AND aw.name LIKE 'Build:%'
  AND COALESCE(w.industry_preset, '') NOT IN (
    'contractors_construction', 'general_contractor'
  );
