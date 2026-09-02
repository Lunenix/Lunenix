-- Painting & Drywall: colors/finishes, HOA exterior approval, surface prep.
-- Automations seed only for industry_preset = painting_drywall.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS work_phase TEXT;

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_work_phase_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_work_phase_check
    CHECK (
      work_phase IS NULL OR work_phase IN (
        'scheduled', 'prep', 'priming', 'painting', 'completed'
      )
    );

ALTER TABLE public.estimate_photos DROP CONSTRAINT IF EXISTS estimate_photos_kind_check;
ALTER TABLE public.estimate_photos
  ADD CONSTRAINT estimate_photos_kind_check
    CHECK (kind IN ('photo', 'drone', 'measurement', 'video', 'surface', 'swatch', 'prep'));

ALTER TABLE public.material_orders DROP CONSTRAINT IF EXISTS material_orders_material_type_check;
ALTER TABLE public.material_orders
  ADD CONSTRAINT material_orders_material_type_check
    CHECK (material_type IN (
      'shingles', 'underlayment', 'dumpster', 'paint', 'primer',
      'drywall', 'compound', 'other'
    ));

CREATE TABLE IF NOT EXISTS public.job_finish_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  room_or_surface TEXT NOT NULL,
  brand TEXT,
  color_name TEXT,
  color_code TEXT,
  sheen TEXT CHECK (
    sheen IS NULL OR sheen IN ('flat', 'eggshell', 'satin', 'semi_gloss', 'gloss')
  ),
  quantity TEXT,
  supplier TEXT,
  match_notes TEXT,
  client_signed_off_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_finish_specs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_job_finish_specs ON public.job_finish_specs;
CREATE POLICY workspace_members_job_finish_specs ON public.job_finish_specs
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

CREATE INDEX IF NOT EXISTS job_finish_specs_workspace
  ON public.job_finish_specs (workspace_id);

CREATE TABLE IF NOT EXISTS public.job_prep_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'other'
    CHECK (kind IN (
      'patching', 'sanding', 'caulking', 'priming',
      'taping', 'mudding', 'texture', 'other'
    )),
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'in_progress', 'done', 'skipped')),
  billed_separately BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_prep_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_job_prep_items ON public.job_prep_items;
CREATE POLICY workspace_members_job_prep_items ON public.job_prep_items
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

CREATE INDEX IF NOT EXISTS job_prep_items_workspace
  ON public.job_prep_items (workspace_id, status);

CREATE TABLE IF NOT EXISTS public.hoa_color_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'needed'
    CHECK (status IN ('needed', 'submitted', 'approved', 'denied', 'not_required')),
  scheme_notes TEXT,
  notes TEXT,
  submitted_on DATE,
  decided_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hoa_color_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_hoa_color_approvals ON public.hoa_color_approvals;
CREATE POLICY workspace_members_hoa_color_approvals ON public.hoa_color_approvals
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

CREATE INDEX IF NOT EXISTS hoa_color_approvals_workspace
  ON public.hoa_color_approvals (workspace_id, status);

CREATE OR REPLACE FUNCTION seed_painting_service_workflows(p_workspace_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  sid UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = p_workspace_id AND w.industry_preset = 'painting_drywall'
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
      'Painting: New lead',
      'When a new lead is created, capture interior vs exterior and repaint vs new/drywall.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'New painting lead: {{lead.title}}',
          'description', 'Set lead source: interior repaint, exterior, new construction, or drywall. Capture name, phone, email, address, rooms/sq ft, and notes. Email to book an estimate. Two-way SMS is not live yet.',
          'due_days', 0
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'Thanks for contacting {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>We received your painting or drywall request. Reply with the address, interior vs exterior, and a couple of times that work for an estimate visit.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Painting: New lead'
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
      'Painting: Schedule estimate visit',
      'On Site Visit, book the estimate and put it on the calendar.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Schedule paint estimate: {{lead.title}}',
          'description', 'Confirm date/time, address, contact, source, rooms/sq ft, interior vs exterior. Add to the calendar with the address. Send confirmation and a reminder. Two-way texting is not live yet.',
          'due_days', 1
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'Your painting estimate visit is booked — {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>We have you down for an on-site estimate. We will come to the address on file. Reply if you need to change the time.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Painting: Schedule estimate visit'
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
      'Painting: Photos and estimate',
      'On Estimate Sent, attach surface photos and send for digital accept.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Upload surface photos: {{lead.title}}',
          'description', 'On Estimates, upload surface condition, drywall damage, existing color, and trim/detail shots. Set photo kind to surface, swatch, or prep.',
          'due_days', 0
        )),
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Send painting estimate: {{lead.title}}',
          'description', 'Price from photos and sq ft. Email the estimate. Track sent / viewed / approved / expired. Approval converts to a job.',
          'due_days', 0
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'Your painting estimate from {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>Your estimate is ready. Please review and reply to approve. We will lock colors and sheen with you before work starts.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Painting: Photos and estimate'
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
      'Painting: Job, colors, HOA, and prep',
      'After Contract Signed, assign crew, lock colors, HOA if exterior, and prep.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Create paint job and assign crew: {{lead.title}}',
          'description', 'Create the job from the approved estimate. Assign a crew. Check Techs for drywall finishing, spray vs brush/roll, and lead-safe certs on older homes. Set work phase on Jobs.',
          'due_days', 1
        )),
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Lock colors and sheen: {{lead.title}}',
          'description', 'On Colors, log brand, code, sheen, and quantity per room. Get client sign-off before paint. Link the supplier order on Materials.',
          'due_days', 1
        )),
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'HOA exterior color approval: {{lead.title}}',
          'description', 'If exterior, add an HOA record on Colors. Interior: mark not required.',
          'due_days', 1
        )),
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Build surface prep list: {{lead.title}}',
          'description', 'On Prep, add patching, sanding, caulking, priming, taping, mudding, and texture match. Mark billed separately when prep is its own line.',
          'due_days', 1
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'You are on the painting schedule — {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>Thanks for approving. Please confirm color and sheen so we can order paint. If the HOA must approve an exterior color, we will keep you posted.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Painting: Job, colors, HOA, and prep'
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
      'Painting: Weather, stock, and receipts',
      'When In Progress, check weather for exterior, stock, and receipts.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Weather, inventory, and receipts: {{lead.title}}',
          'description', 'Ask Luna for weather before exterior dispatch. Toggle weather hold on Jobs. Confirm sprayers, ladders, paint, primer, and drywall in Inventory. Photo receipts on Books. OCR is not auto-filled.',
          'due_days', 0
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Painting: Weather, stock, and receipts'
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
      'Painting: Punch list',
      'On Punch List, walk leftover items and confirm colors on file.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Punch list and color history: {{lead.title}}',
          'description', 'Walk leftover items, get sign-off, and confirm Colors are signed off. Save color history on the contact.',
          'due_days', 1
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Painting: Punch list'
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
      'Painting: Invoice, books, and reviews',
      'When Closed, invoice prep + paint and close books.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Invoice painting job: {{lead.title}}',
          'description', 'Invoice labor + materials, including separately billed prep. Check AR aging. Review job profit on Field ops.',
          'due_days', 1
        )),
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Books, tax set-aside, and history: {{lead.title}}',
          'description', 'Log supplier bills in Books. Keep color history on the contact. Flag negative reviews.',
          'due_days', 1
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Painting: Invoice, books, and reviews'
    );
  END IF;

  INSERT INTO public.automation_workflows (
    workspace_id, name, description, is_active, trigger_type, trigger_config, actions
  )
  SELECT p_workspace_id,
    'Painting: After contract signed (e-sign)',
    'When an e-sign contract completes, kick off colors and prep.',
    true, 'contract_signed', '{}'::jsonb,
    jsonb_build_array(
      jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
        'title', 'Kick off painting job from signed contract',
        'description', 'Create or update the job, lock colors, start HOA if exterior, and build the prep list.',
        'due_days', 0
      ))
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_workflows aw
    WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Painting: After contract signed (e-sign)'
  );

  INSERT INTO public.automation_workflows (
    workspace_id, name, description, is_active, trigger_type, trigger_config, actions
  )
  SELECT p_workspace_id,
    'Painting: After invoice sent',
    'When an invoice is sent, follow AR.',
    true, 'invoice_sent', '{}'::jsonb,
    jsonb_build_array(
      jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
        'title', 'Follow up on invoice payment',
        'description', 'Watch aging. Flag weather holds, HOA pending, leftover prep, or negative reviews.',
        'due_days', 3
      ))
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_workflows aw
    WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Painting: After invoice sent'
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
  END IF;

  IF family = 'field' AND to_regprocedure('seed_field_permit_workflows(uuid)') IS NOT NULL THEN
    PERFORM seed_field_permit_workflows(p_workspace_id);
  END IF;
END;
$fn$;

SELECT seed_painting_service_workflows(id)
FROM public.workspaces
WHERE industry_preset = 'painting_drywall';

DELETE FROM public.automation_workflows aw
USING public.workspaces w
WHERE aw.workspace_id = w.id
  AND aw.name LIKE 'Painting:%'
  AND COALESCE(w.industry_preset, '') <> 'painting_drywall';
