-- Steelworking & Metal Fabrication: drawings/PE, specs, fab queue, weld logs.
-- Automations seed only for steelworking_metal_fabrication. Shared Field: permits stay on.

ALTER TABLE public.estimate_photos DROP CONSTRAINT IF EXISTS estimate_photos_kind_check;
ALTER TABLE public.estimate_photos
  ADD CONSTRAINT estimate_photos_kind_check
    CHECK (kind IN (
      'photo', 'drone', 'measurement', 'video', 'surface', 'swatch', 'prep',
      'infestation', 'entry_point', 'finding', 'thermal', 'moisture',
      'progress', 'existing', 'concealed',
      'inspiration', 'shop', 'joinery', 'final',
      'mill', 'weld', 'erection'
    ));

ALTER TABLE public.material_orders DROP CONSTRAINT IF EXISTS material_orders_material_type_check;
ALTER TABLE public.material_orders
  ADD CONSTRAINT material_orders_material_type_check
    CHECK (material_type IN (
      'shingles', 'underlayment', 'dumpster', 'paint', 'primer',
      'drywall', 'compound', 'chemical', 'bait', 'trap',
      'lumber', 'concrete', 'fixture', 'hardware', 'stain',
      'steel', 'aluminum', 'stainless', 'gas', 'other'
    ));

ALTER TABLE public.job_permits DROP CONSTRAINT IF EXISTS job_permits_kind_check;
ALTER TABLE public.job_permits
  ADD CONSTRAINT job_permits_kind_check
    CHECK (kind IN (
      'city', 'hoa', 'building', 'electrical', 'plumbing', 'mechanical',
      'structural', 'weld', 'other'
    ));

CREATE TABLE IF NOT EXISTS public.steel_drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'revision_requested', 'approved')),
  pe_status TEXT NOT NULL DEFAULT 'not_required'
    CHECK (pe_status IN ('needed', 'submitted', 'stamped', 'not_required')),
  dimensions TEXT,
  weld_notes TEXT,
  drawing_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.steel_drawings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_steel_drawings ON public.steel_drawings;
CREATE POLICY workspace_members_steel_drawings ON public.steel_drawings
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

CREATE INDEX IF NOT EXISTS steel_drawings_workspace
  ON public.steel_drawings (workspace_id, status);

CREATE TABLE IF NOT EXISTS public.steel_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  metal TEXT NOT NULL DEFAULT 'mild'
    CHECK (metal IN ('mild', 'stainless', 'aluminum', 'other')),
  finish TEXT NOT NULL DEFAULT 'raw'
    CHECK (finish IN ('powder', 'galvanized', 'raw', 'paint')),
  thickness TEXT,
  name TEXT NOT NULL,
  cost NUMERIC NOT NULL DEFAULT 0,
  quote_valid_until DATE,
  signed_off_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.steel_specs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_steel_specs ON public.steel_specs;
CREATE POLICY workspace_members_steel_specs ON public.steel_specs
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

CREATE INDEX IF NOT EXISTS steel_specs_workspace
  ON public.steel_specs (workspace_id, metal);

CREATE TABLE IF NOT EXISTS public.steel_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'design_approved'
    CHECK (stage IN (
      'design_approved', 'material_in', 'in_fabrication', 'finishing',
      'ready', 'install'
    )),
  fab_step TEXT
    CHECK (fab_step IS NULL OR fab_step IN (
      'cut', 'weld', 'assembly', 'finishing'
    )),
  fabricator_name TEXT,
  install_on DATE,
  access_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.steel_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_steel_queue ON public.steel_queue;
CREATE POLICY workspace_members_steel_queue ON public.steel_queue
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

CREATE INDEX IF NOT EXISTS steel_queue_workspace
  ON public.steel_queue (workspace_id, stage);

CREATE TABLE IF NOT EXISTS public.steel_weld_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  welder_name TEXT NOT NULL,
  weld_type TEXT NOT NULL DEFAULT 'mig'
    CHECK (weld_type IN ('tig', 'mig', 'stick', 'other')),
  joint TEXT,
  result TEXT NOT NULL DEFAULT 'pending'
    CHECK (result IN ('pending', 'pass', 'fail')),
  ndt_result TEXT NOT NULL DEFAULT 'none'
    CHECK (ndt_result IN ('none', 'pending', 'pass', 'fail')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.steel_weld_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_steel_weld_logs ON public.steel_weld_logs;
CREATE POLICY workspace_members_steel_weld_logs ON public.steel_weld_logs
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

CREATE INDEX IF NOT EXISTS steel_weld_logs_workspace
  ON public.steel_weld_logs (workspace_id, result);

DROP TRIGGER IF EXISTS steel_drawings_updated_at ON public.steel_drawings;
CREATE TRIGGER steel_drawings_updated_at BEFORE UPDATE ON public.steel_drawings
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS steel_specs_updated_at ON public.steel_specs;
CREATE TRIGGER steel_specs_updated_at BEFORE UPDATE ON public.steel_specs
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS steel_queue_updated_at ON public.steel_queue;
CREATE TRIGGER steel_queue_updated_at BEFORE UPDATE ON public.steel_queue
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS steel_weld_logs_updated_at ON public.steel_weld_logs;
CREATE TRIGGER steel_weld_logs_updated_at BEFORE UPDATE ON public.steel_weld_logs
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE OR REPLACE FUNCTION seed_steelworking_workflows(p_workspace_id UUID)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  sid UUID;
BEGIN
  SELECT id INTO sid FROM public.pipeline_stages
    WHERE workspace_id = p_workspace_id AND name = 'Lead'
    ORDER BY position LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO public.automation_workflows (
      workspace_id, name, description, is_active, trigger_type, trigger_config, actions
    )
    SELECT p_workspace_id,
      'Steel: New lead',
      'When a new lead is created, capture structural vs ornamental vs fab source.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'New steel lead: {{lead.title}}',
          'description', 'Set lead source: structural steel, ornamental/railings, custom fab, industrial equipment, referral, or bid invite. Capture name, phone, email, address, project type, and load requirements if structural. Email to book a consult. Two-way SMS is not live yet.',
          'due_days', 0
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'Thanks for contacting {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>We received your fabrication inquiry. Reply with a couple of visit times, the address, and whether this is structural, ornamental, custom fab, or equipment.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Steel: New lead'
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
      'Steel: Schedule consult',
      'On Site Visit, book the consult on the calendar with the address.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Schedule consult / site visit: {{lead.title}}',
          'description', 'Confirm date/time, address, source, project type, load notes. Add to the calendar with the address. Capture existing-structure and measurement photos. Send confirmation and a reminder. Two-way texting is not live. GPS auto-route is not live.',
          'due_days', 0
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'Your site visit is booked — {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>We have you on the calendar for a site visit. Reply if the time or address changes.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Steel: Schedule consult'
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
      'Steel: Quote after drawings',
      'On Estimate Sent, quote from drawings, specs, labor, and engineering fees. Lock quote validity.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Send steel quote: {{lead.title}}',
          'description', 'Confirm drawings approved and PE stamped if load-bearing. Specs signed off with quote-valid date (steel pricing is volatile). On Estimates, include drawings + materials + labor + engineering. Email it. Approval creates the job. Two-way SMS is not live.',
          'due_days', 0
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'Your fabrication quote from {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>Your quote is ready based on the shop drawings and material specs. Please review and reply to approve. Pricing is valid through the date on the quote.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Steel: Quote after drawings'
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
      'Steel: Materials, permits, and queue',
      'After Contract Signed, order mill steel, log permits, and queue fab.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Order steel, log permits, queue fab: {{lead.title}}',
          'description', 'On Materials, order steel/aluminum/stainless/hardware/gas and track mill lead time. On Permits, log structural or weld inspection if required. On Fab, add the piece. Invoice the deposit. Check low stock on Inventory. OCR is not auto-filled.',
          'due_days', 0
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Steel: Materials, permits, and queue'
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
      'Steel: Fabrication and weld logs',
      'When In Progress, run cut/weld/assembly/finish and weld/NDT documentation.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Run the fab shop: {{lead.title}}',
          'description', 'On Fab, move stages. Assign welder/fabricator. On Welds, log weld type, joint, inspection, and NDT. Upload mill, weld, and progress photos on Estimates. Check welder certs on Techs. GPS auto-track is not live.',
          'due_days', 0
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Steel: Fabrication and weld logs'
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
      'Steel: Delivery and erection',
      'On Punch List, schedule delivery/erection and walk punch items.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Deliver or erect: {{lead.title}}',
          'description', 'On Fab, set install date, crew, and site prep (access, power, crane/rigging). Confirm weld inspections passed on Permits. Upload erection/final photos. Walk punch items. Two-way SMS is not live.',
          'due_days', 0
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'Ready for install — {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>Your steel is ready. We will confirm delivery or erection next. Reply if crane access or power needs extra planning.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Steel: Delivery and erection'
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
      'Steel: Invoice and books',
      'When Closed, invoice remaining milestones and check fab margin vs steel cost.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Completion invoice and books: {{lead.title}}',
          'description', 'Invoice remaining (material, fab complete, install/final). Check AR aging. Log mill and gas receipts in Books. Compare materials + shop labor + install vs price on Field ops. Flag negative reviews. OCR is not auto-filled.',
          'due_days', 1
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Steel: Invoice and books'
    );
  END IF;

  INSERT INTO public.automation_workflows (
    workspace_id, name, description, is_active, trigger_type, trigger_config, actions
  )
  SELECT p_workspace_id,
    'Steel: After contract signed (e-sign)',
    'When an e-sign contract completes, order mill steel and queue fab.',
    true, 'contract_signed', '{}'::jsonb,
    jsonb_build_array(
      jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
        'title', 'Kick off fab from signed contract',
        'description', 'Create or update the job, log permits, order steel, add the fab queue row, and send the deposit invoice.',
        'due_days', 0
      ))
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_workflows aw
    WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Steel: After contract signed (e-sign)'
  );

  INSERT INTO public.automation_workflows (
    workspace_id, name, description, is_active, trigger_type, trigger_config, actions
  )
  SELECT p_workspace_id,
    'Steel: After invoice sent',
    'When an invoice is sent, follow AR (deposit, material, fab, install).',
    true, 'invoice_sent', '{}'::jsonb,
    jsonb_build_array(
      jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
        'title', 'Follow up on steel invoice',
        'description', 'Watch aging. Send a reminder if overdue. Flag delayed mill delivery, pending PE stamps, failed weld inspections, or jobs behind on Fab.',
        'due_days', 3
      ))
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_workflows aw
    WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Steel: After invoice sent'
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
  ELSIF COALESCE(p_preset, '') = 'woodworking_custom_carpentry' THEN
    PERFORM seed_woodworking_workflows(p_workspace_id);
  ELSIF COALESCE(p_preset, '') = 'steelworking_metal_fabrication' THEN
    PERFORM seed_steelworking_workflows(p_workspace_id);
  END IF;

  IF family = 'field'
     AND COALESCE(p_preset, '') NOT IN (
       'cleaning_services', 'inspection_service', 'rental_company',
       'woodworking_custom_carpentry'
     )
     AND to_regprocedure('seed_field_permit_workflows(uuid)') IS NOT NULL THEN
    PERFORM seed_field_permit_workflows(p_workspace_id);
  END IF;
END;
$fn$;

SELECT seed_steelworking_workflows(id)
FROM public.workspaces
WHERE industry_preset = 'steelworking_metal_fabrication';

DELETE FROM public.automation_workflows aw
USING public.workspaces w
WHERE aw.workspace_id = w.id
  AND aw.name LIKE 'Steel:%'
  AND COALESCE(w.industry_preset, '') <> 'steelworking_metal_fabrication';
