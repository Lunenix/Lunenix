-- Event Venue ops. Isolated tables + RLS. Does not merge Bar, Planner, or Field packs.
-- Shared CRM (contacts, invoices, contracts, estimates, books) stays as-is.

CREATE TABLE IF NOT EXISTS public.venue_spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  capacity_banquet INT,
  capacity_theater INT,
  capacity_cocktail INT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.venue_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  space_name TEXT,
  event_on DATE,
  event_type TEXT NOT NULL DEFAULT 'wedding'
    CHECK (event_type IN ('wedding', 'corporate', 'private_party', 'other')),
  lead_source TEXT,
  guest_count INT,
  rental_tier TEXT NOT NULL DEFAULT 'ceremony_reception'
    CHECK (rental_tier IN ('ceremony_reception', 'reception_only', 'hourly_corporate')),
  included_items TEXT,
  addons TEXT,
  hours NUMERIC,
  overtime_rate NUMERIC,
  tour_at TIMESTAMPTZ,
  load_in_at TIMESTAMPTZ,
  event_start_at TIMESTAMPTZ,
  event_end_at TIMESTAMPTZ,
  load_out_at TIMESTAMPTZ,
  access_notes TEXT,
  staff_notes TEXT,
  vendor_windows TEXT,
  deposit_paid BOOLEAN NOT NULL DEFAULT false,
  retainer_amount NUMERIC NOT NULL DEFAULT 0,
  damage_deposit_amount NUMERIC NOT NULL DEFAULT 0,
  damage_deposit_status TEXT NOT NULL DEFAULT 'none'
    CHECK (damage_deposit_status IN ('none', 'held', 'refunded', 'deducted')),
  date_held BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'inquiry'
    CHECK (status IN ('inquiry', 'held', 'booked', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.venue_tours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  tour_at TIMESTAMPTZ,
  space_name TEXT,
  talking_points TEXT,
  client_questions TEXT,
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.venue_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('caterer', 'bar', 'rentals', 'dj', 'florist', 'other')),
  preferred BOOLEAN NOT NULL DEFAULT true,
  required_inhouse BOOLEAN NOT NULL DEFAULT false,
  coi_expires_on DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.venue_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'other'
    CHECK (kind IN ('alcohol', 'outside_vendor', 'coi', 'other')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.venue_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'client_insurance'
    CHECK (kind IN ('client_insurance', 'vendor_coi', 'liquor_license')),
  expires_on DATE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'on_file', 'expired')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.venue_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  space_name TEXT,
  layout_type TEXT NOT NULL DEFAULT 'banquet'
    CHECK (layout_type IN ('banquet', 'theater', 'cocktail', 'ceremony', 'corporate')),
  capacity INT,
  photo_url TEXT,
  client_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (client_status IN ('pending', 'approved', 'revision')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.venue_crew (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'coordinator'
    CHECK (role IN ('coordinator', 'setup', 'security', 'bartender')),
  cert TEXT,
  rating NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.venue_turnovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  from_event TEXT,
  to_event TEXT,
  buffer_hours NUMERIC,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'done', 'tight')),
  condition_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.venue_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'facility'
    CHECK (kind IN ('equipment', 'facility', 'vendor_repair')),
  status TEXT NOT NULL DEFAULT 'ok'
    CHECK (status IN ('ok', 'needs_service', 'scheduled')),
  next_service_on DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.venue_onsite (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'before_photo'
    CHECK (kind IN ('before_photo', 'after_photo', 'incident', 'walkthrough')),
  image_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.venue_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'held'
    CHECK (status IN ('none', 'held', 'refunded', 'deducted')),
  assessment_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $policies$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'venue_spaces', 'venue_bookings', 'venue_tours', 'venue_vendors',
    'venue_policies', 'venue_compliance', 'venue_layouts', 'venue_crew',
    'venue_turnovers', 'venue_maintenance', 'venue_onsite', 'venue_deposits'
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

CREATE INDEX IF NOT EXISTS venue_spaces_workspace ON public.venue_spaces (workspace_id);
CREATE INDEX IF NOT EXISTS venue_bookings_workspace ON public.venue_bookings (workspace_id, event_on);
CREATE INDEX IF NOT EXISTS venue_tours_workspace ON public.venue_tours (workspace_id, tour_at);
CREATE INDEX IF NOT EXISTS venue_vendors_workspace ON public.venue_vendors (workspace_id, category);
CREATE INDEX IF NOT EXISTS venue_policies_workspace ON public.venue_policies (workspace_id, kind);
CREATE INDEX IF NOT EXISTS venue_compliance_workspace ON public.venue_compliance (workspace_id, status);
CREATE INDEX IF NOT EXISTS venue_layouts_workspace ON public.venue_layouts (workspace_id);
CREATE INDEX IF NOT EXISTS venue_crew_workspace ON public.venue_crew (workspace_id, role);
CREATE INDEX IF NOT EXISTS venue_turnovers_workspace ON public.venue_turnovers (workspace_id, status);
CREATE INDEX IF NOT EXISTS venue_maintenance_workspace ON public.venue_maintenance (workspace_id, status);
CREATE INDEX IF NOT EXISTS venue_onsite_workspace ON public.venue_onsite (workspace_id, kind);
CREATE INDEX IF NOT EXISTS venue_deposits_workspace ON public.venue_deposits (workspace_id, status);

DROP TRIGGER IF EXISTS venue_spaces_updated_at ON public.venue_spaces;
CREATE TRIGGER venue_spaces_updated_at BEFORE UPDATE ON public.venue_spaces
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS venue_bookings_updated_at ON public.venue_bookings;
CREATE TRIGGER venue_bookings_updated_at BEFORE UPDATE ON public.venue_bookings
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS venue_tours_updated_at ON public.venue_tours;
CREATE TRIGGER venue_tours_updated_at BEFORE UPDATE ON public.venue_tours
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS venue_vendors_updated_at ON public.venue_vendors;
CREATE TRIGGER venue_vendors_updated_at BEFORE UPDATE ON public.venue_vendors
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS venue_policies_updated_at ON public.venue_policies;
CREATE TRIGGER venue_policies_updated_at BEFORE UPDATE ON public.venue_policies
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS venue_compliance_updated_at ON public.venue_compliance;
CREATE TRIGGER venue_compliance_updated_at BEFORE UPDATE ON public.venue_compliance
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS venue_layouts_updated_at ON public.venue_layouts;
CREATE TRIGGER venue_layouts_updated_at BEFORE UPDATE ON public.venue_layouts
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS venue_crew_updated_at ON public.venue_crew;
CREATE TRIGGER venue_crew_updated_at BEFORE UPDATE ON public.venue_crew
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS venue_turnovers_updated_at ON public.venue_turnovers;
CREATE TRIGGER venue_turnovers_updated_at BEFORE UPDATE ON public.venue_turnovers
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS venue_maintenance_updated_at ON public.venue_maintenance;
CREATE TRIGGER venue_maintenance_updated_at BEFORE UPDATE ON public.venue_maintenance
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS venue_onsite_updated_at ON public.venue_onsite;
CREATE TRIGGER venue_onsite_updated_at BEFORE UPDATE ON public.venue_onsite
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS venue_deposits_updated_at ON public.venue_deposits;
CREATE TRIGGER venue_deposits_updated_at BEFORE UPDATE ON public.venue_deposits
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
