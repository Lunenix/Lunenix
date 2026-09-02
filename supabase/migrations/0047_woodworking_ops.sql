-- Woodworking & Custom Carpentry: shop drawings, material selections, fab queue.
-- Automations seed only for woodworking_custom_carpentry. Shared Field: permits stay off.

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS next_service_on DATE;

ALTER TABLE public.estimate_photos DROP CONSTRAINT IF EXISTS estimate_photos_kind_check;
ALTER TABLE public.estimate_photos
  ADD CONSTRAINT estimate_photos_kind_check
    CHECK (kind IN (
      'photo', 'drone', 'measurement', 'video', 'surface', 'swatch', 'prep',
      'infestation', 'entry_point', 'finding', 'thermal', 'moisture',
      'progress', 'existing', 'concealed',
      'inspiration', 'shop', 'joinery', 'final'
    ));

ALTER TABLE public.material_orders DROP CONSTRAINT IF EXISTS material_orders_material_type_check;
ALTER TABLE public.material_orders
  ADD CONSTRAINT material_orders_material_type_check
    CHECK (material_type IN (
      'shingles', 'underlayment', 'dumpster', 'paint', 'primer',
      'drywall', 'compound', 'chemical', 'bait', 'trap',
      'lumber', 'concrete', 'fixture', 'hardware', 'stain', 'other'
    ));

CREATE TABLE IF NOT EXISTS public.shop_designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'revision_requested', 'approved')),
  dimensions TEXT,
  joinery_notes TEXT,
  drawing_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_designs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_shop_designs ON public.shop_designs;
CREATE POLICY workspace_members_shop_designs ON public.shop_designs
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

CREATE INDEX IF NOT EXISTS shop_designs_workspace
  ON public.shop_designs (workspace_id, status);

CREATE TABLE IF NOT EXISTS public.shop_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'species'
    CHECK (kind IN ('species', 'finish', 'hardware')),
  name TEXT NOT NULL,
  cost NUMERIC NOT NULL DEFAULT 0,
  photo_url TEXT,
  signed_off_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_selections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_shop_selections ON public.shop_selections;
CREATE POLICY workspace_members_shop_selections ON public.shop_selections
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

CREATE INDEX IF NOT EXISTS shop_selections_workspace
  ON public.shop_selections (workspace_id, kind);

CREATE TABLE IF NOT EXISTS public.shop_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'design_approved'
    CHECK (stage IN (
      'design_approved', 'material_in', 'in_fabrication', 'finishing',
      'ready', 'install', 'pickup'
    )),
  fab_step TEXT
    CHECK (fab_step IS NULL OR fab_step IN (
      'cut', 'mill', 'assembly', 'sanding', 'finishing'
    )),
  craftsman_name TEXT,
  install_on DATE,
  access_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_shop_queue ON public.shop_queue;
CREATE POLICY workspace_members_shop_queue ON public.shop_queue
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

CREATE INDEX IF NOT EXISTS shop_queue_workspace
  ON public.shop_queue (workspace_id, stage);

DROP TRIGGER IF EXISTS shop_designs_updated_at ON public.shop_designs;
CREATE TRIGGER shop_designs_updated_at BEFORE UPDATE ON public.shop_designs
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS shop_selections_updated_at ON public.shop_selections;
CREATE TRIGGER shop_selections_updated_at BEFORE UPDATE ON public.shop_selections
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS shop_queue_updated_at ON public.shop_queue;
CREATE TRIGGER shop_queue_updated_at BEFORE UPDATE ON public.shop_queue
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE OR REPLACE FUNCTION seed_woodworking_workflows(p_workspace_id UUID)
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
      'Shop: New lead',
      'When a new lead is created, capture furniture vs built-in vs millwork source.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'New shop lead: {{lead.title}}',
          'description', 'Set lead source: custom furniture, built-ins, cabinetry, trim/millwork, referral, or portfolio. Capture name, phone, email, address, piece vs built-in vs install, and notes. Email to book a consult. Two-way SMS is not live yet.',
          'due_days', 0
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'Thanks for contacting {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>We received your inquiry. Reply with a couple of consult times, the address, and whether this is a furniture piece, built-in, cabinetry, or millwork.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Shop: New lead'
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
      'Shop: Schedule consult',
      'On Site Visit, book the consult on the calendar with the address.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Schedule consult / site visit: {{lead.title}}',
          'description', 'Confirm date/time, address, source, project type, space dimensions. Add to the calendar with the address. Capture site and inspiration photos (kinds inspiration or measurement). Send confirmation and a reminder. Two-way texting is not live. GPS auto-route is not live.',
          'due_days', 0
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'Your consult is booked — {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>We have you on the calendar for a consult. Reply to this email if the time or address changes. Bring inspiration photos if you have them.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Shop: Schedule consult'
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
      'Shop: Quote after design',
      'On Estimate Sent, quote from approved design, selections, and labor.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Send shop quote: {{lead.title}}',
          'description', 'Confirm design approved and wood/finish/hardware signed off. On Estimates, build the quote from design + materials + labor. Email it. Track sent / viewed / approved / expired. Approval creates the job. Two-way SMS is not live.',
          'due_days', 0
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'Your quote from {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>Your quote is ready based on the approved drawings and material selections. Please review and reply to approve.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Shop: Quote after design'
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
      'Shop: Materials and queue',
      'After Contract Signed, order lumber/hardware and put the piece on the shop queue.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Order materials and queue the shop: {{lead.title}}',
          'description', 'On Materials, order lumber and hardware (types lumber, hardware, stain) and track lead time. On Shop, add the piece (stage design approved then material in). Invoice the deposit. Check low stock on Inventory. OCR is not auto-filled.',
          'due_days', 0
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Shop: Materials and queue'
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
      'Shop: Fabrication',
      'When In Progress, run cut/mill/assembly/sanding/finishing and progress photos.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Run the shop: {{lead.title}}',
          'description', 'On Shop, move stages (in fabrication → finishing → ready). Assign craftsman. Upload shop, joinery, and progress photos on Estimates. QC fit and dimensions before finishing. Email “your piece is in the shop.” GPS auto-track is not live.',
          'due_days', 0
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Shop: Fabrication'
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
      'Shop: Delivery and install',
      'On Punch List, schedule delivery or install and walk punch items.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Deliver or install: {{lead.title}}',
          'description', 'On Shop, set install/pickup date, crew, and site prep (access, stairs, tight spaces). Upload final photos. Walk punch items. Email ready for delivery. Two-way SMS is not live.',
          'due_days', 0
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'Ready for delivery — {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>Your piece is ready. We will confirm delivery or pickup next. Reply if access or stairs need extra planning.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Shop: Delivery and install'
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
      'Shop: Invoice and books',
      'When Closed, invoice remaining milestones and check shop margin.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Completion invoice and books: {{lead.title}}',
          'description', 'Invoice remaining (material and completion). Check AR aging. Log lumber/hardware receipts in Books. Compare materials + shop labor + install vs price on Field ops. Flag negative reviews. OCR is not auto-filled.',
          'due_days', 1
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Shop: Invoice and books'
    );
  END IF;

  INSERT INTO public.automation_workflows (
    workspace_id, name, description, is_active, trigger_type, trigger_config, actions
  )
  SELECT p_workspace_id,
    'Shop: After contract signed (e-sign)',
    'When an e-sign contract completes, order materials and queue the shop.',
    true, 'contract_signed', '{}'::jsonb,
    jsonb_build_array(
      jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
        'title', 'Kick off shop from signed contract',
        'description', 'Create or update the job, order lumber/hardware, add the shop queue row, and send the deposit invoice.',
        'due_days', 0
      ))
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_workflows aw
    WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Shop: After contract signed (e-sign)'
  );

  INSERT INTO public.automation_workflows (
    workspace_id, name, description, is_active, trigger_type, trigger_config, actions
  )
  SELECT p_workspace_id,
    'Shop: After invoice sent',
    'When an invoice is sent, follow AR (deposit, material, completion).',
    true, 'invoice_sent', '{}'::jsonb,
    jsonb_build_array(
      jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
        'title', 'Follow up on shop invoice',
        'description', 'Watch aging. Send a reminder if overdue. Flag delayed material, pending design approvals, or jobs behind on the shop queue.',
        'due_days', 3
      ))
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_workflows aw
    WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Shop: After invoice sent'
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

SELECT seed_woodworking_workflows(id)
FROM public.workspaces
WHERE industry_preset = 'woodworking_custom_carpentry';

DELETE FROM public.automation_workflows aw
USING public.workspaces w
WHERE aw.workspace_id = w.id
  AND aw.name LIKE 'Shop:%'
  AND COALESCE(w.industry_preset, '') <> 'woodworking_custom_carpentry';
