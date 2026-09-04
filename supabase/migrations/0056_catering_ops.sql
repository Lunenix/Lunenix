-- Catering ops. Isolated tables + RLS. Does not merge Bar, Planner, Venue, or Bridal.
-- Shared CRM (contacts, invoices, contracts, estimates, books, inventory) stays as-is.

CREATE TABLE IF NOT EXISTS public.catering_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  event_on DATE,
  venue_name TEXT,
  venue_address TEXT,
  guest_count INT,
  headcount_confirmed BOOLEAN NOT NULL DEFAULT false,
  event_type TEXT NOT NULL DEFAULT 'wedding'
    CHECK (event_type IN ('wedding', 'corporate', 'private_party', 'other')),
  lead_source TEXT,
  budget_range TEXT,
  dietary_notes TEXT,
  vegan_count INT,
  gf_count INT,
  nut_free_count INT,
  service_style TEXT NOT NULL DEFAULT 'buffet'
    CHECK (service_style IN ('buffet', 'plated', 'family_style', 'stations', 'drop_off')),
  tasting_at TIMESTAMPTZ,
  load_in_at TIMESTAMPTZ,
  service_start_at TIMESTAMPTZ,
  service_end_at TIMESTAMPTZ,
  load_out_at TIMESTAMPTZ,
  staff_notes TEXT,
  equipment_checklist TEXT,
  route_notes TEXT,
  deposit_paid BOOLEAN NOT NULL DEFAULT false,
  retainer_amount NUMERIC NOT NULL DEFAULT 0,
  package_price NUMERIC,
  food_cost NUMERIC,
  labor_cost NUMERIC,
  rental_cost NUMERIC,
  must_haves TEXT,
  avoid_items TEXT,
  status TEXT NOT NULL DEFAULT 'inquiry'
    CHECK (status IN ('inquiry', 'tasting', 'booked', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.catering_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  service_style TEXT NOT NULL DEFAULT 'buffet'
    CHECK (service_style IN ('buffet', 'plated', 'family_style', 'stations', 'drop_off')),
  courses TEXT,
  tasting_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.catering_tastings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  tasting_at TIMESTAMPTZ,
  feedback TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.catering_vision (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  image_url TEXT,
  theme_colors TEXT,
  presentation_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.catering_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'food_handler'
    CHECK (kind IN ('food_handler', 'health_license', 'coi', 'alcohol_permit')),
  holder_name TEXT,
  expires_on DATE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'on_file', 'expired')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.catering_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  purveyor TEXT,
  delivery_on DATE,
  waste_notes TEXT,
  status TEXT NOT NULL DEFAULT 'needed'
    CHECK (status IN ('needed', 'ordered', 'delivered')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.catering_prep (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  station TEXT,
  assignee_name TEXT,
  checklist TEXT,
  equipment_needs TEXT,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'done')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.catering_crew (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'chef'
    CHECK (role IN ('chef', 'server', 'bartender', 'captain')),
  cert TEXT,
  rating NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.catering_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'kitchen'
    CHECK (kind IN ('kitchen', 'transport', 'serving', 'rental')),
  qty INT,
  reorder_below INT,
  condition_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.catering_onsite (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'presentation'
    CHECK (kind IN ('presentation', 'temp_log', 'incident')),
  image_url TEXT,
  temp_f NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $policies$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'catering_events', 'catering_menus', 'catering_tastings', 'catering_vision',
    'catering_compliance', 'catering_orders', 'catering_prep', 'catering_crew',
    'catering_equipment', 'catering_onsite'
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

CREATE INDEX IF NOT EXISTS catering_events_workspace ON public.catering_events (workspace_id, event_on);
CREATE INDEX IF NOT EXISTS catering_menus_workspace ON public.catering_menus (workspace_id);
CREATE INDEX IF NOT EXISTS catering_tastings_workspace ON public.catering_tastings (workspace_id, tasting_at);
CREATE INDEX IF NOT EXISTS catering_vision_workspace ON public.catering_vision (workspace_id);
CREATE INDEX IF NOT EXISTS catering_compliance_workspace ON public.catering_compliance (workspace_id, status);
CREATE INDEX IF NOT EXISTS catering_orders_workspace ON public.catering_orders (workspace_id, status);
CREATE INDEX IF NOT EXISTS catering_prep_workspace ON public.catering_prep (workspace_id, due_at);
CREATE INDEX IF NOT EXISTS catering_crew_workspace ON public.catering_crew (workspace_id, role);
CREATE INDEX IF NOT EXISTS catering_equipment_workspace ON public.catering_equipment (workspace_id, kind);
CREATE INDEX IF NOT EXISTS catering_onsite_workspace ON public.catering_onsite (workspace_id, kind);

DROP TRIGGER IF EXISTS catering_events_updated_at ON public.catering_events;
CREATE TRIGGER catering_events_updated_at BEFORE UPDATE ON public.catering_events
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS catering_menus_updated_at ON public.catering_menus;
CREATE TRIGGER catering_menus_updated_at BEFORE UPDATE ON public.catering_menus
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS catering_tastings_updated_at ON public.catering_tastings;
CREATE TRIGGER catering_tastings_updated_at BEFORE UPDATE ON public.catering_tastings
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS catering_vision_updated_at ON public.catering_vision;
CREATE TRIGGER catering_vision_updated_at BEFORE UPDATE ON public.catering_vision
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS catering_compliance_updated_at ON public.catering_compliance;
CREATE TRIGGER catering_compliance_updated_at BEFORE UPDATE ON public.catering_compliance
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS catering_orders_updated_at ON public.catering_orders;
CREATE TRIGGER catering_orders_updated_at BEFORE UPDATE ON public.catering_orders
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS catering_prep_updated_at ON public.catering_prep;
CREATE TRIGGER catering_prep_updated_at BEFORE UPDATE ON public.catering_prep
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS catering_crew_updated_at ON public.catering_crew;
CREATE TRIGGER catering_crew_updated_at BEFORE UPDATE ON public.catering_crew
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS catering_equipment_updated_at ON public.catering_equipment;
CREATE TRIGGER catering_equipment_updated_at BEFORE UPDATE ON public.catering_equipment
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS catering_onsite_updated_at ON public.catering_onsite;
CREATE TRIGGER catering_onsite_updated_at BEFORE UPDATE ON public.catering_onsite
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
