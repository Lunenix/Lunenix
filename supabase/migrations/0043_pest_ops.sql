-- Pest Control: treatment logs, property access, quarterly/skip on recurring plans.
-- Automations seed only for industry_preset = pest_control.

ALTER TABLE public.service_plans
  ADD COLUMN IF NOT EXISTS skip_until DATE;

ALTER TABLE public.service_plans DROP CONSTRAINT IF EXISTS service_plans_frequency_check;
ALTER TABLE public.service_plans
  ADD CONSTRAINT service_plans_frequency_check
    CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'seasonal'));

ALTER TABLE public.estimate_photos DROP CONSTRAINT IF EXISTS estimate_photos_kind_check;
ALTER TABLE public.estimate_photos
  ADD CONSTRAINT estimate_photos_kind_check
    CHECK (kind IN (
      'photo', 'drone', 'measurement', 'video', 'surface', 'swatch', 'prep',
      'infestation', 'entry_point'
    ));

ALTER TABLE public.material_orders DROP CONSTRAINT IF EXISTS material_orders_material_type_check;
ALTER TABLE public.material_orders
  ADD CONSTRAINT material_orders_material_type_check
    CHECK (material_type IN (
      'shingles', 'underlayment', 'dumpster', 'paint', 'primer',
      'drywall', 'compound', 'chemical', 'bait', 'trap', 'other'
    ));

CREATE TABLE IF NOT EXISTS public.pest_treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  epa_number TEXT,
  method TEXT NOT NULL DEFAULT 'other'
    CHECK (method IN ('spray', 'bait', 'trap', 'granular', 'foam', 'other')),
  quantity TEXT,
  target_pest TEXT,
  treatment_area TEXT,
  treated_on DATE NOT NULL DEFAULT (CURRENT_DATE),
  guarantee_days INTEGER,
  retreatment_until DATE,
  status TEXT NOT NULL DEFAULT 'logged'
    CHECK (status IN ('logged', 'guarantee_open', 'retreatment_due', 'closed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pest_treatments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_pest_treatments ON public.pest_treatments;
CREATE POLICY workspace_members_pest_treatments ON public.pest_treatments
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

CREATE INDEX IF NOT EXISTS pest_treatments_workspace
  ON public.pest_treatments (workspace_id, status);

CREATE TABLE IF NOT EXISTS public.property_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  entry_method TEXT NOT NULL DEFAULT 'occupant'
    CHECK (entry_method IN ('occupant', 'gate', 'garage', 'lockbox', 'other')),
  has_entry_code BOOLEAN NOT NULL DEFAULT false,
  entry_code TEXT,
  pets_notes TEXT,
  child_safety TEXT,
  chemical_sensitive TEXT,
  special_instructions TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.property_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_property_access ON public.property_access;
CREATE POLICY workspace_members_property_access ON public.property_access
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

CREATE INDEX IF NOT EXISTS property_access_workspace
  ON public.property_access (workspace_id);

CREATE OR REPLACE FUNCTION seed_pest_service_workflows(p_workspace_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  sid UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = p_workspace_id AND w.industry_preset = 'pest_control'
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
      'Pest: New lead',
      'When a new lead is created, capture one-time vs recurring and pest type.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'New pest lead: {{lead.title}}',
          'description', 'Set lead source: one-time treatment vs recurring plan, and pest type. Capture name, phone, email, address, property size, and notes. Email to book a visit. Two-way SMS is not live yet.',
          'due_days', 0
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'Thanks for contacting {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>We received your pest control request. Reply with the address, pest type if you know it, and a couple of times that work for an inspection.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Pest: New lead'
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
      'Pest: Schedule visit',
      'On Site Visit, book the inspection and put it on the calendar.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Schedule pest visit: {{lead.title}}',
          'description', 'Confirm date/time, address, contact, source, pest type, and property size. Add to the calendar with the address. Send confirmation and a reminder. Two-way texting is not live yet.',
          'due_days', 1
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Pest: Schedule visit'
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
      'Pest: Photos and estimate',
      'On Estimate Sent, attach inspection photos and send one-time or plan pricing.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Upload inspection photos: {{lead.title}}',
          'description', 'On Estimates, upload infestation evidence, entry points, damage, and problem areas.',
          'due_days', 0
        )),
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Send pest estimate: {{lead.title}}',
          'description', 'Price one-time treatment and/or a recurring plan. Email the estimate. Approval converts to a job. Recurring plans are set on Recurring plans.',
          'due_days', 0
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Pest: Photos and estimate'
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
      'Pest: Job, plan, access, and licenses',
      'After Contract Signed, assign a licensed tech, set the plan, and capture access/safety.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Create visit and assign tech: {{lead.title}}',
          'description', 'Create the job. Assign a tech. Confirm pesticide applicator license on Techs. Set route order on Jobs. GPS auto-optimize is not live.',
          'due_days', 1
        )),
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Set recurring service plan: {{lead.title}}',
          'description', 'If ongoing, open Recurring plans. Set monthly, quarterly, or seasonal. Use skip-until for holds.',
          'due_days', 1
        )),
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Access and safety notes: {{lead.title}}',
          'description', 'On Access, log entry method, pets, kids, aquariums, gardens, and allergies. Do not paste gate codes into Luna chat.',
          'due_days', 1
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Pest: Job, plan, access, and licenses'
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
      'Pest: Treatment log, stock, and mileage',
      'When In Progress, log chemicals, route miles, and receipts.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Log treatment and guarantee: {{lead.title}}',
          'description', 'On Treatments, log product, EPA number, method, quantity, target pest, and area. Set guarantee days. Log mileage. OCR is not auto-filled.',
          'due_days', 0
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Pest: Treatment log, stock, and mileage'
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
      'Pest: Punch list and callbacks',
      'On Punch List, note leftover entry points and callbacks.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Follow-up and re-treatment window: {{lead.title}}',
          'description', 'If pests return inside the guarantee, mark the treatment re-treatment due. Watch license renewals on Field ops.',
          'due_days', 1
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Pest: Punch list and callbacks'
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
      'Pest: Invoice, books, and reviews',
      'When Closed, invoice the visit or plan and close books.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Invoice visit or recurring cycle: {{lead.title}}',
          'description', 'Invoice the job or let Recurring plans auto-draft. Check AR aging. Review recurring revenue on Field ops.',
          'due_days', 1
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Pest: Invoice, books, and reviews'
    );
  END IF;

  INSERT INTO public.automation_workflows (
    workspace_id, name, description, is_active, trigger_type, trigger_config, actions
  )
  SELECT p_workspace_id,
    'Pest: After contract signed (e-sign)',
    'When an e-sign contract completes, kick off the visit and plan.',
    true, 'contract_signed', '{}'::jsonb,
    jsonb_build_array(
      jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
        'title', 'Kick off pest job from signed contract',
        'description', 'Create or update the job, set a recurring plan if ongoing, and capture access/safety notes (no codes in chat).',
        'due_days', 0
      ))
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_workflows aw
    WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Pest: After contract signed (e-sign)'
  );

  INSERT INTO public.automation_workflows (
    workspace_id, name, description, is_active, trigger_type, trigger_config, actions
  )
  SELECT p_workspace_id,
    'Pest: After invoice sent',
    'When an invoice is sent, follow AR.',
    true, 'invoice_sent', '{}'::jsonb,
    jsonb_build_array(
      jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
        'title', 'Follow up on invoice payment',
        'description', 'Watch aging. Flag re-treatment requests, license renewals, or negative reviews.',
        'due_days', 3
      ))
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_workflows aw
    WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Pest: After invoice sent'
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
  END IF;

  IF family = 'field' AND to_regprocedure('seed_field_permit_workflows(uuid)') IS NOT NULL THEN
    PERFORM seed_field_permit_workflows(p_workspace_id);
  END IF;
END;
$fn$;

SELECT seed_pest_service_workflows(id)
FROM public.workspaces
WHERE industry_preset = 'pest_control';

DELETE FROM public.automation_workflows aw
USING public.workspaces w
WHERE aw.workspace_id = w.id
  AND aw.name LIKE 'Pest:%'
  AND COALESCE(w.industry_preset, '') <> 'pest_control';
