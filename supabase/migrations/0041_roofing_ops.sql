-- Roofing & Exterior Repair: insurance claims, material delivery, weather holds,
-- inspection photo kinds. Automations seed only for industry_preset = roofing_exterior_repair.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS weather_hold BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS weather_hold_reason TEXT;

ALTER TABLE public.estimate_photos
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'photo';

ALTER TABLE public.estimate_photos DROP CONSTRAINT IF EXISTS estimate_photos_kind_check;
ALTER TABLE public.estimate_photos
  ADD CONSTRAINT estimate_photos_kind_check
    CHECK (kind IN ('photo', 'drone', 'measurement', 'video'));

CREATE TABLE IF NOT EXISTS public.insurance_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  estimate_id UUID REFERENCES public.estimates(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  insurance_company TEXT,
  policy_number TEXT,
  claim_number TEXT,
  status TEXT NOT NULL DEFAULT 'filed'
    CHECK (status IN (
      'filed',
      'adjuster_scheduled',
      'approved',
      'denied',
      'supplement_pending',
      'paid',
      'closed'
    )),
  pricing_mode TEXT NOT NULL DEFAULT 'insurance'
    CHECK (pricing_mode IN ('insurance', 'out_of_pocket')),
  adjuster_name TEXT,
  adjuster_phone TEXT,
  adjuster_email TEXT,
  adjuster_at TIMESTAMPTZ,
  scope_notes TEXT,
  supplement_notes TEXT,
  acv_amount NUMERIC(12,2),
  depreciation_amount NUMERIC(12,2),
  acv_paid_on DATE,
  depreciation_paid_on DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_insurance_claims ON public.insurance_claims;
CREATE POLICY workspace_members_insurance_claims ON public.insurance_claims
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

CREATE INDEX IF NOT EXISTS insurance_claims_workspace_status
  ON public.insurance_claims (workspace_id, status);

CREATE TABLE IF NOT EXISTS public.material_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  material_type TEXT NOT NULL DEFAULT 'shingles'
    CHECK (material_type IN ('shingles', 'underlayment', 'dumpster', 'other')),
  color TEXT,
  quantity TEXT,
  vendor TEXT,
  status TEXT NOT NULL DEFAULT 'needed'
    CHECK (status IN (
      'needed',
      'ordered',
      'in_transit',
      'delivered',
      'delayed',
      'cancelled'
    )),
  delivery_on DATE,
  dropoff_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.material_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_material_orders ON public.material_orders;
CREATE POLICY workspace_members_material_orders ON public.material_orders
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

CREATE INDEX IF NOT EXISTS material_orders_workspace_status
  ON public.material_orders (workspace_id, status);

CREATE OR REPLACE FUNCTION seed_roofing_service_workflows(p_workspace_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  sid UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = p_workspace_id AND w.industry_preset = 'roofing_exterior_repair'
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
      'Roofing: New lead',
      'When a new lead is created, capture storm/insurance vs out-of-pocket vs referral.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'New roofing lead: {{lead.title}}',
          'description', 'Set lead source on the pipeline card: storm damage/insurance, out-of-pocket, or referral. Capture name, phone, email, property address, and damage notes. Email to book an inspection. Two-way SMS is not live yet — use email and the contact record.',
          'due_days', 0
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'Thanks for contacting {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>We received your roofing request. Reply with the property address, a couple of inspection times, and whether this is insurance or out-of-pocket work.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Roofing: New lead'
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
      'Roofing: Schedule inspection',
      'On Site Visit, book the inspection/estimate and put it on the calendar.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Schedule roof inspection: {{lead.title}}',
          'description', 'Confirm date/time, address, contact name and number, lead source, damage type/notes, and insurance info if applicable. Add it to the calendar with the address for routing. Send confirmation and a reminder. Two-way texting is not live yet.',
          'due_days', 1
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'Your roof inspection is booked — {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>We have you down for an on-site roof inspection. We will come to the address on file. Reply if you need to change the time. If this is an insurance claim, have your claim number handy for the visit.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Roofing: Schedule inspection'
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
      'Roofing: Inspection photos and estimate',
      'On Estimate Sent, attach drone/roof photos and send insurance or out-of-pocket pricing.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Upload inspection photos: {{lead.title}}',
          'description', 'On Estimates, upload roof photos, drone shots, and measurements (set photo kind). Document damage for the claim. Video files can be linked in notes until a drone video uploader is added.',
          'due_days', 0
        )),
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Send roofing estimate: {{lead.title}}',
          'description', 'Price from insurance scope or out-of-pocket. Email the estimate. Track sent / viewed / approved / expired. Approval converts to a job.',
          'due_days', 0
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'Your roofing estimate from {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>Your estimate is ready. Please review and reply to approve, or tell us what to adjust. If this is an insurance job, we will also keep the claim file updated.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Roofing: Inspection photos and estimate'
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
      'Roofing: Job, claim, permits, and materials',
      'After Contract Signed, open the job, claim file, permits, and material orders.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Create roofing job and assign crew: {{lead.title}}',
          'description', 'Create the job from the approved estimate. Assign a crew. Confirm fall protection/OSHA and ladder safety on Techs. Flag weather hold on Jobs if rain, wind, or extreme heat delays work.',
          'due_days', 1
        )),
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Open insurance claim file: {{lead.title}}',
          'description', 'On Claims, log company, claim status, adjuster, and meet-the-adjuster time. Store Xactimate/scope notes. Track supplements if extra damage is found. Policy numbers stay on the claim record — do not paste them into Luna chat.',
          'due_days', 1
        )),
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Permits for replacement or structural repair: {{lead.title}}',
          'description', 'On Permits, flag full roof replacement or structural repair. Track applied, approved, inspection scheduled/passed. Store permit numbers and notes. If none is required, log not required.',
          'due_days', 1
        )),
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Order materials and dumpster: {{lead.title}}',
          'description', 'On Material orders, log shingles (color/type/qty), underlayment, and dumpster/roll-off with delivery date and drop-off notes. Flag delayed or waiting-on-delivery jobs.',
          'due_days', 1
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'You are on the roofing schedule — {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>Thanks for approving. We are assigning a crew, ordering materials, and tracking any permit or insurance steps. We will confirm the work window and let you know when materials are arriving.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Roofing: Job, claim, permits, and materials'
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
      'Roofing: Weather, stock, and receipts',
      'When In Progress, check weather, stock, and receipts.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Weather, inventory, and receipts: {{lead.title}}',
          'description', 'Ask Luna for weather before dispatch. Toggle weather hold on Jobs for rain, wind, or extreme heat. Confirm ladders, harnesses, nail guns, leftover stock, and dumpsters in Inventory. Photo receipts on Books (materials, dumpster, supplier invoices). OCR is not auto-filled. GPS auto-route is not live.',
          'due_days', 0
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'Crew update from {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>We are lining up the crew and materials for your roof. We will reschedule if weather makes the job unsafe. Reply to this email with questions.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Roofing: Weather, stock, and receipts'
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
      'Roofing: Punch list and city inspection',
      'On Punch List, finish leftovers and city inspection.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Punch list and permit inspection: {{lead.title}}',
          'description', 'Walk leftover items, get sign-off, and log city inspection on Permits. Note roof history on the contact. Watch claim supplements on Field ops.',
          'due_days', 1
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Roofing: Punch list and city inspection'
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
      'Roofing: Invoice, ACV, books, and reviews',
      'When Closed, invoice to insurance or customer and close books.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Invoice and insurance payments: {{lead.title}}',
          'description', 'Invoice to match insurance scope or out-of-pocket pricing. On Claims, track ACV vs depreciation payments. Check AR aging and send reminders if overdue. Review job profit (materials + labor + dumpster vs price/claim payout) on Field ops.',
          'due_days', 1
        )),
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Books, tax set-aside, and history: {{lead.title}}',
          'description', 'Log vendor/supplier bills in Books. Field ops shows income vs expenses and a 30% tax set-aside hint from profit. Save roof history on the contact. Flag negative reviews.',
          'due_days', 1
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'Thanks — invoice from {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>The roof work is complete. Your invoice is coming next. If this is an insurance job, we will also note ACV and any remaining depreciation payment on the claim file.</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Roofing: Invoice, ACV, books, and reviews'
    );
  END IF;

  INSERT INTO public.automation_workflows (
    workspace_id, name, description, is_active, trigger_type, trigger_config, actions
  )
  SELECT p_workspace_id,
    'Roofing: After contract signed (e-sign)',
    'When an e-sign contract completes, kick off the job, claim, and materials.',
    true, 'contract_signed', '{}'::jsonb,
    jsonb_build_array(
      jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
        'title', 'Kick off roofing job from signed contract',
        'description', 'Create or update the job, open the claim file if insurance, order materials, and start permit tracking for full replacement or structural repair.',
        'due_days', 0
      ))
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_workflows aw
    WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Roofing: After contract signed (e-sign)'
  );

  INSERT INTO public.automation_workflows (
    workspace_id, name, description, is_active, trigger_type, trigger_config, actions
  )
  SELECT p_workspace_id,
    'Roofing: After invoice sent',
    'When an invoice is sent, follow AR and claim payments.',
    true, 'invoice_sent', '{}'::jsonb,
    jsonb_build_array(
      jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
        'title', 'Follow up on invoice and claim payment',
        'description', 'Watch aging. Track ACV and depreciation on Claims. Flag permit delays, weather holds, pending supplements, or negative reviews.',
        'due_days', 3
      ))
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_workflows aw
    WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Roofing: After invoice sent'
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
  END IF;

  IF family = 'field' AND to_regprocedure('seed_field_permit_workflows(uuid)') IS NOT NULL THEN
    PERFORM seed_field_permit_workflows(p_workspace_id);
  END IF;
END;
$fn$;

SELECT seed_roofing_service_workflows(id)
FROM public.workspaces
WHERE industry_preset = 'roofing_exterior_repair';

DELETE FROM public.automation_workflows aw
USING public.workspaces w
WHERE aw.workspace_id = w.id
  AND aw.name LIKE 'Roofing:%'
  AND COALESCE(w.industry_preset, '') <> 'roofing_exterior_repair';
