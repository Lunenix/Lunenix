-- Mobile Bartending ops. Seed automations only for mobile_bartending.
-- Does not merge HVAC/Field packs. Shared Field: permits stay off (event sector).

ALTER TABLE public.estimate_photos DROP CONSTRAINT IF EXISTS estimate_photos_kind_check;
ALTER TABLE public.estimate_photos
  ADD CONSTRAINT estimate_photos_kind_check
    CHECK (kind IN (
      'photo', 'drone', 'measurement', 'video', 'surface', 'swatch', 'prep',
      'infestation', 'entry_point', 'finding', 'thermal', 'moisture',
      'progress', 'existing', 'concealed',
      'inspiration', 'shop', 'joinery', 'final',
      'mill', 'weld', 'erection',
      'bar_setup', 'bar_menu', 'incident'
    ));

ALTER TABLE public.material_orders DROP CONSTRAINT IF EXISTS material_orders_material_type_check;
ALTER TABLE public.material_orders
  ADD CONSTRAINT material_orders_material_type_check
    CHECK (material_type IN (
      'shingles', 'underlayment', 'dumpster', 'paint', 'primer',
      'drywall', 'compound', 'chemical', 'bait', 'trap',
      'lumber', 'concrete', 'fixture', 'hardware', 'stain',
      'steel', 'aluminum', 'stainless', 'gas',
      'alcohol', 'mixer', 'garnish', 'glassware', 'ice', 'other'
    ));

CREATE TABLE IF NOT EXISTS public.bar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  event_on DATE,
  venue_name TEXT,
  venue_address TEXT,
  guest_count INT,
  event_type TEXT NOT NULL DEFAULT 'private_party'
    CHECK (event_type IN ('wedding', 'corporate', 'private_party', 'other')),
  lead_source TEXT,
  package_tier TEXT NOT NULL DEFAULT 'full_open'
    CHECK (package_tier IN ('beer_wine', 'full_open', 'signature', 'mocktail', 'custom')),
  consult_at TIMESTAMPTZ,
  consult_kind TEXT NOT NULL DEFAULT 'call'
    CHECK (consult_kind IN ('call', 'tasting', 'in_person')),
  hours NUMERIC,
  addons TEXT,
  load_in_at TIMESTAMPTZ,
  event_start_at TIMESTAMPTZ,
  event_end_at TIMESTAMPTZ,
  breakdown_at TIMESTAMPTZ,
  staff_notes TEXT,
  equipment_checklist TEXT,
  venue_access TEXT,
  theme_colors TEXT,
  must_haves TEXT,
  avoid_items TEXT,
  status TEXT NOT NULL DEFAULT 'inquiry'
    CHECK (status IN ('inquiry', 'booked', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bar_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  package_tier TEXT NOT NULL DEFAULT 'full_open'
    CHECK (package_tier IN ('beer_wine', 'full_open', 'signature', 'mocktail', 'custom')),
  setup_style TEXT NOT NULL DEFAULT 'cart'
    CHECK (setup_style IN ('cart', 'tent', 'indoor')),
  cocktails TEXT,
  mocktails TEXT,
  dietary_notes TEXT,
  garnish_notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'approved')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bar_looks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'mockup'
    CHECK (kind IN ('mockup', 'inspiration')),
  title TEXT NOT NULL,
  image_url TEXT,
  venue_photo_url TEXT,
  client_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (client_status IN ('pending', 'approved', 'revision')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bar_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'liquor_license'
    CHECK (kind IN (
      'liquor_license', 'catering_permit', 'liability', 'venue_requirement', 'tips_cert'
    )),
  name TEXT NOT NULL,
  holder_name TEXT,
  expires_on DATE,
  status TEXT NOT NULL DEFAULT 'needed'
    CHECK (status IN ('needed', 'valid', 'expiring', 'expired')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bar_supply_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  vendor_name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'alcohol'
    CHECK (kind IN ('alcohol', 'mixer', 'garnish', 'glassware', 'ice', 'other')),
  status TEXT NOT NULL DEFAULT 'needed'
    CHECK (status IN ('needed', 'ordered', 'pickup', 'delivered', 'returned')),
  pickup_on DATE,
  leftover_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bar_crew (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'bartender'
    CHECK (role IN ('bartender', 'barback')),
  tips_expires_on DATE,
  food_handler_expires_on DATE,
  rating NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bar_onsite (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'setup_photo'
    CHECK (kind IN ('setup_photo', 'consumption', 'incident')),
  title TEXT NOT NULL,
  image_url TEXT,
  incident_kind TEXT
    CHECK (incident_kind IS NULL OR incident_kind IN ('refusal', 'spill', 'other')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $policies$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bar_events', 'bar_menus', 'bar_looks', 'bar_compliance',
    'bar_supply_orders', 'bar_crew', 'bar_onsite'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS workspace_members_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY workspace_members_%I ON public.%I FOR ALL
        USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()))
        WITH CHECK (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()))',
      t, t
    );
  END LOOP;
END
$policies$;

CREATE INDEX IF NOT EXISTS bar_events_workspace ON public.bar_events (workspace_id, event_on);
CREATE INDEX IF NOT EXISTS bar_menus_workspace ON public.bar_menus (workspace_id, status);
CREATE INDEX IF NOT EXISTS bar_looks_workspace ON public.bar_looks (workspace_id, kind);
CREATE INDEX IF NOT EXISTS bar_compliance_workspace ON public.bar_compliance (workspace_id, expires_on);
CREATE INDEX IF NOT EXISTS bar_supply_orders_workspace ON public.bar_supply_orders (workspace_id, status);
CREATE INDEX IF NOT EXISTS bar_crew_workspace ON public.bar_crew (workspace_id, role);
CREATE INDEX IF NOT EXISTS bar_onsite_workspace ON public.bar_onsite (workspace_id, kind);

DROP TRIGGER IF EXISTS bar_events_updated_at ON public.bar_events;
CREATE TRIGGER bar_events_updated_at BEFORE UPDATE ON public.bar_events
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS bar_menus_updated_at ON public.bar_menus;
CREATE TRIGGER bar_menus_updated_at BEFORE UPDATE ON public.bar_menus
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS bar_looks_updated_at ON public.bar_looks;
CREATE TRIGGER bar_looks_updated_at BEFORE UPDATE ON public.bar_looks
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS bar_compliance_updated_at ON public.bar_compliance;
CREATE TRIGGER bar_compliance_updated_at BEFORE UPDATE ON public.bar_compliance
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS bar_supply_orders_updated_at ON public.bar_supply_orders;
CREATE TRIGGER bar_supply_orders_updated_at BEFORE UPDATE ON public.bar_supply_orders
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS bar_crew_updated_at ON public.bar_crew;
CREATE TRIGGER bar_crew_updated_at BEFORE UPDATE ON public.bar_crew
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS bar_onsite_updated_at ON public.bar_onsite;
CREATE TRIGGER bar_onsite_updated_at BEFORE UPDATE ON public.bar_onsite
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE OR REPLACE FUNCTION seed_mobile_bartending_workflows(p_workspace_id UUID)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  sid UUID;
BEGIN
  SELECT id INTO sid FROM public.pipeline_stages
    WHERE workspace_id = p_workspace_id AND name = 'Inquiry'
    ORDER BY position LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO public.automation_workflows (
      workspace_id, name, description, is_active, trigger_type, trigger_config, actions
    )
    SELECT p_workspace_id,
      'Bar: New inquiry',
      'When an inquiry lands, capture event source and basics.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'New bar inquiry: {{lead.title}}',
          'description', 'Set lead source: wedding, corporate event, private party, referral, or venue partnership. Capture name, phone, email, event date, venue, guest count, event type, and package interest. Email to book a consult or tasting. Two-way SMS is not live yet.',
          'due_days', 0
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'Thanks for contacting {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>We received your bartending inquiry. Reply with your event date, venue, guest count, and a few times for a call or tasting.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Bar: New inquiry'
    );
  END IF;

  SELECT id INTO sid FROM public.pipeline_stages
    WHERE workspace_id = p_workspace_id AND name = 'Consultation'
    ORDER BY position LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO public.automation_workflows (
      workspace_id, name, description, is_active, trigger_type, trigger_config, actions
    )
    SELECT p_workspace_id,
      'Bar: Schedule consult',
      'On Consultation, book a call or tasting on the calendar.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Schedule consult / tasting: {{lead.title}}',
          'description', 'On Events, log event date, venue, guest count, type, source, package interest, and consult kind (call, tasting, or in-person). Add it to the calendar. Send confirmation and a reminder. Two-way texting is not live. GPS auto-route is not live.',
          'due_days', 0
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'Your consultation is booked — {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>We have your consult on the calendar. Reply if the time or venue changes.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Bar: Schedule consult'
    );
  END IF;

  SELECT id INTO sid FROM public.pipeline_stages
    WHERE workspace_id = p_workspace_id AND name = 'Proposal Sent'
    ORDER BY position LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO public.automation_workflows (
      workspace_id, name, description, is_active, trigger_type, trigger_config, actions
    )
    SELECT p_workspace_id,
      'Bar: Send estimate',
      'On Proposal Sent, quote guests + package + hours + add-ons.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Send bar estimate: {{lead.title}}',
          'description', 'Confirm menu and look approval. On Estimates, quote guest count + package + hours + glassware/garnish/ice. Email it. Track sent / viewed / approved / expired. On approval, convert to a booked event and invoice the deposit. Two-way SMS is not live. Luna never collects cards.',
          'due_days', 0
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'Your bartending estimate from {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>Your estimate is ready from guest count, package, hours, and add-ons. Please review and reply to approve. A deposit invoice follows approval.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Bar: Send estimate'
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
      'Bar: Booked event ops',
      'After Contract Signed, log licenses, order product, and staff the event.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Compliance, orders, and crew: {{lead.title}}',
          'description', 'On Compliance, log liquor/catering permit, liability COI, venue rider, and TIPS certs. On Bar orders, order alcohol/mixers/garnish by guest count. On Crew, assign bartenders/barbacks. Invoice remaining balance due before the event. OCR is not auto-filled.',
          'due_days', 1
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Bar: Booked event ops'
    );
  END IF;

  SELECT id INTO sid FROM public.pipeline_stages
    WHERE workspace_id = p_workspace_id AND name = 'Planning'
    ORDER BY position LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO public.automation_workflows (
      workspace_id, name, description, is_active, trigger_type, trigger_config, actions
    )
    SELECT p_workspace_id,
      'Bar: Event logistics',
      'On Planning, lock load-in, staffing, and packing lists.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Lock logistics: {{lead.title}}',
          'description', 'On Events, set load-in, start/end, breakdown, equipment checklist, and venue access (dock, power, water). Confirm final headcount. Check Inventory for carts/coolers/glassware. Flag staffing gaps on Bar ops.',
          'due_days', 2
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'Final headcount and payment — {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>Please confirm final guest count. Final payment is due before the event. Reply with any menu or must-have changes.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Bar: Event logistics'
    );
  END IF;

  SELECT id INTO sid FROM public.pipeline_stages
    WHERE workspace_id = p_workspace_id AND name = 'Day-Of'
    ORDER BY position LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO public.automation_workflows (
      workspace_id, name, description, is_active, trigger_type, trigger_config, actions
    )
    SELECT p_workspace_id,
      'Bar: Day-of',
      'On Day-Of, run setup photos, consumption, and incident notes.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Day-of bar checklist: {{lead.title}}',
          'description', 'Confirm crew and load-in. On On-site, log setup photos, consumption if overage applies, and any refusal/spill incidents. Email the client that the team is arriving. Two-way SMS is not live.',
          'due_days', 0
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Bar: Day-of'
    );
  END IF;

  SELECT id INTO sid FROM public.pipeline_stages
    WHERE workspace_id = p_workspace_id AND name = 'Follow-Up'
    ORDER BY position LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO public.automation_workflows (
      workspace_id, name, description, is_active, trigger_type, trigger_config, actions
    )
    SELECT p_workspace_id,
      'Bar: Follow-up',
      'On Follow-Up, leftover returns, overage invoice, and thank-you.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object('type', 'create_task', 'config', jsonb_build_object(
          'title', 'Close the event: {{lead.title}}',
          'description', 'On Bar orders, log leftover/returnable bottles. On Invoices, add gratuity/overage if needed. Tag receipts on Books (OCR is not auto-filled). Request a review. Track repeat corporate/venue clients on the contact.',
          'due_days', 1
        )),
        jsonb_build_object('type', 'send_email', 'config', jsonb_build_object(
          'to', '{{contact.email}}',
          'subject', 'Thank you from {{workspace.name}}',
          'body', '<p>Hi {{contact.first_name}},</p><p>Thank you for having us. If anything is still open on the invoice, we will send it next. We would love a review when you have a moment.</p><p>{{workspace.name}}</p>'
        ))
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Bar: Follow-up'
    );
  END IF;
END
$fn$;
