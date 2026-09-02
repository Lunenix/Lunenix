-- Extra owned workspaces are $8 each (one-time slot). Super-admins are
-- unlimited in application code. Isolated billing table; not a CRM table.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS extra_workspace_slots integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.billing_events (
  id text PRIMARY KEY,
  kind text NOT NULL,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.grant_extra_workspace_slot(
  p_event_id text,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.billing_events (id, kind, user_id)
  VALUES (p_event_id, 'extra_workspace_slot', p_user_id);

  UPDATE public.profiles
  SET extra_workspace_slots = extra_workspace_slots + 1,
      updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, extra_workspace_slots, updated_at)
    VALUES (p_user_id, 1, now())
    ON CONFLICT (id) DO UPDATE
      SET extra_workspace_slots = public.profiles.extra_workspace_slots + 1,
          updated_at = now();
  END IF;

  RETURN true;
EXCEPTION
  WHEN unique_violation THEN
    RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_extra_workspace_slot(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_extra_workspace_slot(text, uuid) TO service_role;

