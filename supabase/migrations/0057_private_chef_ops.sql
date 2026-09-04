-- Private Chef ops. Isolated tables + RLS. Does not merge Catering or Bar packs.
-- Shared CRM (contacts, invoices, contracts, estimates, books, inventory) stays as-is.
-- Recurring visits are rows you schedule. This does not auto-bill Stripe subscriptions.

CREATE TABLE IF NOT EXISTS public.chef_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  service_type TEXT NOT NULL DEFAULT 'meal_prep'
    CHECK (service_type IN ('meal_prep', 'dinner_party', 'recurring_chef', 'other')),
  household_size INT,
  dietary_notes TEXT,
  allergies TEXT,
  dislikes TEXT,
  health_goals TEXT,
  favorites TEXT,
  never_make TEXT,
  meal_times TEXT,
  portions TEXT,
  budget_range TEXT,
  lead_source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chef_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  entry_method TEXT NOT NULL DEFAULT 'present'
    CHECK (entry_method IN ('key', 'code', 'present', 'housekeeper')),
  entry_notes TEXT,
  kitchen_on_hand TEXT,
  bring_list TEXT,
  pet_notes TEXT,
  storage_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chef_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'weekly'
    CHECK (kind IN ('weekly', 'event')),
  dishes TEXT,
  nutrition_notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'approved')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chef_vision (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  image_url TEXT,
  presentation_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chef_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'weekly'
    CHECK (frequency IN ('weekly', 'biweekly')),
  paused BOOLEAN NOT NULL DEFAULT false,
  skip_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chef_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  visit_on DATE,
  starts_at TIMESTAMPTZ,
  service_type TEXT NOT NULL DEFAULT 'meal_prep'
    CHECK (service_type IN ('meal_prep', 'dinner_party', 'recurring_chef', 'other')),
  household_size INT,
  grocery_cost NUMERIC,
  chef_fee NUMERIC,
  dietary_notes TEXT,
  kitchen_access TEXT,
  budget_range TEXT,
  lead_source TEXT,
  checklist TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'shopping', 'cooking', 'complete', 'skipped')),
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chef_shopping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  vendor_name TEXT,
  list_text TEXT,
  receipt_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chef_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  made_on DATE,
  reheat_notes TEXT,
  shelf_life TEXT,
  allergy_precautions TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chef_crew (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cert TEXT,
  rating NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chef_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  qty INT,
  reorder_below INT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $policies$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'chef_profiles', 'chef_access', 'chef_menus', 'chef_vision', 'chef_plans',
    'chef_visits', 'chef_shopping', 'chef_labels', 'chef_crew', 'chef_equipment'
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

CREATE INDEX IF NOT EXISTS chef_profiles_workspace ON public.chef_profiles (workspace_id);
CREATE INDEX IF NOT EXISTS chef_access_workspace ON public.chef_access (workspace_id);
CREATE INDEX IF NOT EXISTS chef_menus_workspace ON public.chef_menus (workspace_id, status);
CREATE INDEX IF NOT EXISTS chef_vision_workspace ON public.chef_vision (workspace_id);
CREATE INDEX IF NOT EXISTS chef_plans_workspace ON public.chef_plans (workspace_id);
CREATE INDEX IF NOT EXISTS chef_visits_workspace ON public.chef_visits (workspace_id, visit_on);
CREATE INDEX IF NOT EXISTS chef_shopping_workspace ON public.chef_shopping (workspace_id);
CREATE INDEX IF NOT EXISTS chef_labels_workspace ON public.chef_labels (workspace_id, made_on);
CREATE INDEX IF NOT EXISTS chef_crew_workspace ON public.chef_crew (workspace_id);
CREATE INDEX IF NOT EXISTS chef_equipment_workspace ON public.chef_equipment (workspace_id);

DROP TRIGGER IF EXISTS chef_profiles_updated_at ON public.chef_profiles;
CREATE TRIGGER chef_profiles_updated_at BEFORE UPDATE ON public.chef_profiles
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS chef_access_updated_at ON public.chef_access;
CREATE TRIGGER chef_access_updated_at BEFORE UPDATE ON public.chef_access
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS chef_menus_updated_at ON public.chef_menus;
CREATE TRIGGER chef_menus_updated_at BEFORE UPDATE ON public.chef_menus
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS chef_vision_updated_at ON public.chef_vision;
CREATE TRIGGER chef_vision_updated_at BEFORE UPDATE ON public.chef_vision
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS chef_plans_updated_at ON public.chef_plans;
CREATE TRIGGER chef_plans_updated_at BEFORE UPDATE ON public.chef_plans
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS chef_visits_updated_at ON public.chef_visits;
CREATE TRIGGER chef_visits_updated_at BEFORE UPDATE ON public.chef_visits
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS chef_shopping_updated_at ON public.chef_shopping;
CREATE TRIGGER chef_shopping_updated_at BEFORE UPDATE ON public.chef_shopping
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS chef_labels_updated_at ON public.chef_labels;
CREATE TRIGGER chef_labels_updated_at BEFORE UPDATE ON public.chef_labels
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS chef_crew_updated_at ON public.chef_crew;
CREATE TRIGGER chef_crew_updated_at BEFORE UPDATE ON public.chef_crew
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS chef_equipment_updated_at ON public.chef_equipment;
CREATE TRIGGER chef_equipment_updated_at BEFORE UPDATE ON public.chef_equipment
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
