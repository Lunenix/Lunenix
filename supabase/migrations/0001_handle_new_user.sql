-- Phase 1 migration: auto-create a profile row when a new auth user is created.
--
-- This is the ONLY new SQL for Phase 1. It does NOT touch the existing
-- workspaces / profiles / workspace_members tables or their RLS policies.
--
-- Apply it in the Supabase SQL Editor (or via the Management API with a
-- personal access token). The application's /auth/callback route also upserts
-- the profile as a functional fallback, so the app works either way.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, updated_at)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
