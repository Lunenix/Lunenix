-- Rental Company: fleet assets, reservations, check-out/in condition, maintenance.
-- Automations seed only for industry_preset = rental_company.
-- Rentals do not get the shared Field: permit pair.

CREATE TABLE IF NOT EXISTS public.rental_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN (
      'excavator', 'loader', 'lift', 'generator', 'trailer', 'tool', 'other'
    )),
  location TEXT NOT NULL DEFAULT 'yard'
    CHECK (location IN ('yard', 'out', 'in_transit', 'in_repair')),
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'reserved', 'out', 'maintenance', 'retired')),
  hourly_rate NUMERIC NOT NULL DEFAULT 0,
  daily_rate NUMERIC NOT NULL DEFAULT 0,
  weekly_rate NUMERIC NOT NULL DEFAULT 0,
  purchase_cost NUMERIC,
  purchased_on DATE,
  hours_used NUMERIC NOT NULL DEFAULT 0,
  service_interval_hours NUMERIC,
  last_serviced_on DATE,
  next_service_on DATE,
  fuel_level TEXT,
  last_known_location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rental_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_rental_assets ON public.rental_assets;
CREATE POLICY workspace_members_rental_assets ON public.rental_assets
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

CREATE INDEX IF NOT EXISTS rental_assets_workspace
  ON public.rental_assets (workspace_id, status, location);

CREATE TABLE IF NOT EXISTS public.rental_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES public.rental_assets(id) ON DELETE SET NULL,
  estimate_id UUID REFERENCES public.estimates(id) ON DELETE SET NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  pickup_method TEXT NOT NULL DEFAULT 'pickup'
    CHECK (pickup_method IN ('pickup', 'delivery')),
  job_site_address TEXT,
  status TEXT NOT NULL DEFAULT 'hold'
    CHECK (status IN (
      'hold', 'reserved', 'checked_out', 'returned', 'cancelled', 'overdue'
    )),
  rate_type TEXT NOT NULL DEFAULT 'daily'
    CHECK (rate_type IN ('hourly', 'daily', 'weekly')),
  rate_amount NUMERIC NOT NULL DEFAULT 0,
  deposit_amount NUMERIC NOT NULL DEFAULT 0,
  damage_waiver BOOLEAN NOT NULL DEFAULT false,
  late_fee NUMERIC NOT NULL DEFAULT 0,
  damage_charge NUMERIC NOT NULL DEFAULT 0,
  account_terms TEXT,
  checked_out_on TIMESTAMPTZ,
  returned_on TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rental_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_rental_reservations ON public.rental_reservations;
CREATE POLICY workspace_members_rental_reservations ON public.rental_reservations
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

CREATE INDEX IF NOT EXISTS rental_reservations_workspace
  ON public.rental_reservations (workspace_id, status, ends_on);

CREATE TABLE IF NOT EXISTS public.rental_condition_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES public.rental_reservations(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.rental_assets(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'checkout'
    CHECK (kind IN ('checkout', 'checkin', 'delivery')),
  photo_url TEXT,
  fuel_level TEXT,
  notes TEXT,
  logged_on DATE NOT NULL DEFAULT (CURRENT_DATE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rental_condition_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_rental_condition_logs ON public.rental_condition_logs;
CREATE POLICY workspace_members_rental_condition_logs ON public.rental_condition_logs
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

CREATE INDEX IF NOT EXISTS rental_condition_logs_workspace
  ON public.rental_condition_logs (workspace_id, reservation_id);

CREATE TABLE IF NOT EXISTS public.rental_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.rental_assets(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_repair', 'complete')),
  hours_at_service NUMERIC,
  cost NUMERIC,
  due_on DATE,
  completed_on DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rental_maintenance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_rental_maintenance ON public.rental_maintenance;
CREATE POLICY workspace_members_rental_maintenance ON public.rental_maintenance
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

CREATE INDEX IF NOT EXISTS rental_maintenance_workspace
  ON public.rental_maintenance (workspace_id, status);

CREATE OR REPLACE FUNCTION seed_rental_company_workflows(p_workspace_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  sid UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = p_workspace_id AND w.industry_preset = 'rental_company'
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
      'Rental: New inquiry',
      'When a new inquiry is created, capture walk-in vs phone vs online vs contractor.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'New rental inquiry: {{lead.title}}',
          'description', 'Set lead source: walk-in, phone, online booking, or contractor account. Capture name, phone, email, needed dates, pickup vs delivery, and job site if delivered. Email to confirm. Two-way SMS is not live yet.',
          'due_days', 0
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'Thanks for contacting {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>We received your rental request. Reply with the dates you need, pickup or delivery, and the equipment type if you know it.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Rental: New inquiry'
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
      'Rental: Availability and hold',
      'On Site Visit, check fleet availability and place a hold.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Check availability and hold: {{lead.title}}',
          'description', 'On Fleet, confirm the item is available for those dates. On Rentals, create a hold with pickup vs delivery and job site. Record deposit amount — do not take card numbers in Luna. GPS auto-track is not live. Two-way texting is not live.',
          'due_days', 0
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Rental: Availability and hold'
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
      'Rental: Quote and waiver',
      'On Estimate Sent, send rates, add-ons, and damage waiver.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Send rental quote: {{lead.title}}',
          'description', 'Build the estimate from hourly/daily/weekly rates plus attachments. Include damage waiver. Email it. Approval converts to a job and a reserved rental on Rentals.',
          'due_days', 0
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Rental: Quote and waiver'
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
      'Rental: Confirm reservation and delivery',
      'After Contract Signed, confirm the reservation and schedule delivery if needed.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Confirm reservation and logistics: {{lead.title}}',
          'description', 'Mark the rental reserved. If delivery, assign a driver on Techs (CDL if required) and set route order. Send confirmation and a reminder before pickup/delivery. GPS auto-route is not live.',
          'due_days', 0
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Rental: Confirm reservation and delivery'
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
      'Rental: Check-out',
      'When In Progress, document condition and check the unit out.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Check out equipment: {{lead.title}}',
          'description', 'On Rentals, log check-out photos/notes and fuel if it uses gas. Verify ID and signed contract in person — do not store ID or card numbers in Luna. Record the deposit amount only. Set the asset out. OCR is not auto-filled.',
          'due_days', 0
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Rental: Check-out'
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
      'Rental: Check-in and damage',
      'On Punch List, check the unit in, compare condition, and apply late or damage charges.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Check in and inspect: {{lead.title}}',
          'description', 'On Rentals, log check-in photos and fuel. Compare to check-out notes. Late fees calculate from the due date vs return. Add damage charges if needed. Return the asset to the yard or send it to Maintenance.',
          'due_days', 0
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Rental: Check-in and damage'
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
      'Rental: Invoice, books, and utilization',
      'When Closed, invoice the rental period plus fees and review utilization.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Invoice rental and books: {{lead.title}}',
          'description', 'Invoice base rate + extensions + late fees + damage. Contractor net terms stay on the rental notes. Check AR. Log parts/fuel in Books. Field ops shows overdue returns, maintenance due, and utilization on Fleet. Flag negative reviews.',
          'due_days', 1
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Rental: Invoice, books, and utilization'
    );
  END IF;

  INSERT INTO public.automation_workflows (
    workspace_id, name, description, is_active, trigger_type, trigger_config, actions
  )
  SELECT p_workspace_id,
    'Rental: After contract signed (e-sign)',
    'When an e-sign rental agreement completes, confirm the hold.',
    true, 'contract_signed', '{}'::jsonb,
    jsonb_build_array(
      jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
        'title', 'Confirm rental from signed agreement',
        'description', 'Create or update the reservation, assign delivery if needed, and send pickup/delivery confirmation.',
        'due_days', 0
      ))
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_workflows aw
    WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Rental: After contract signed (e-sign)'
  );

  INSERT INTO public.automation_workflows (
    workspace_id, name, description, is_active, trigger_type, trigger_config, actions
  )
  SELECT p_workspace_id,
    'Rental: After invoice sent',
    'When an invoice is sent, follow AR.',
    true, 'invoice_sent', '{}'::jsonb,
    jsonb_build_array(
      jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
        'title', 'Follow up on rental invoice',
        'description', 'Watch aging. Flag overdue returns, maintenance due, or negative reviews.',
        'due_days', 3
      ))
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_workflows aw
    WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Rental: After invoice sent'
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

SELECT seed_rental_company_workflows(id)
FROM public.workspaces
WHERE industry_preset = 'rental_company';

DELETE FROM public.automation_workflows aw
USING public.workspaces w
WHERE aw.workspace_id = w.id
  AND aw.name LIKE 'Rental:%'
  AND COALESCE(w.industry_preset, '') <> 'rental_company';
