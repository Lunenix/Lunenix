-- Phase 1 security hardening on EXISTING tables.
-- Does not recreate contacts, tasks, invoices, contracts, profiles, or workspaces.

CREATE OR REPLACE FUNCTION public.jwt_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin') = 'true',
    false
  );
$$;

REVOKE ALL ON FUNCTION public.jwt_is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jwt_is_super_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(target_workspace_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF target_workspace_id IS NULL OR auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = target_workspace_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_workspace_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin(uuid) TO authenticated;

-- Billing slots may only change via service_role / SECURITY DEFINER RPCs.
CREATE OR REPLACE FUNCTION public.protect_profile_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.extra_workspace_slots IS DISTINCT FROM OLD.extra_workspace_slots
     AND current_user IN ('authenticated', 'anon') THEN
    NEW.extra_workspace_slots := COALESCE(OLD.extra_workspace_slots, 0);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_billing_columns ON public.profiles;
CREATE TRIGGER protect_profile_billing_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.protect_profile_billing_columns();

DROP POLICY IF EXISTS "workspace_ai_settings_insert" ON public.workspace_ai_settings;
CREATE POLICY "workspace_ai_settings_insert" ON public.workspace_ai_settings
  FOR INSERT
  WITH CHECK (public.is_workspace_admin(workspace_id));

DROP POLICY IF EXISTS "workspace_ai_settings_update" ON public.workspace_ai_settings;
CREATE POLICY "workspace_ai_settings_update" ON public.workspace_ai_settings
  FOR UPDATE
  USING (public.is_workspace_admin(workspace_id))
  WITH CHECK (public.is_workspace_admin(workspace_id));
