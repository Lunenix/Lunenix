-- Un-merge trade default automations.
-- 0034 seeded HVAC onto every Home & Field workspace. This seeder is HVAC-only.
-- Delete HVAC / Handyman / Plumbing / Electrical packs from the wrong workspaces.
-- HVAC workflow rows for HVAC workspaces are inserted by the app seeder.

CREATE OR REPLACE FUNCTION seed_field_service_workflows(p_workspace_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = p_workspace_id AND w.industry_preset = 'hvac'
  ) THEN
    RETURN;
  END IF;
END;
$fn$;

DELETE FROM public.automation_workflows aw
USING public.workspaces w
WHERE aw.workspace_id = w.id
  AND (
    (aw.name LIKE 'HVAC:%' AND COALESCE(w.industry_preset, '') <> 'hvac')
    OR (aw.name LIKE 'Handyman:%' AND COALESCE(w.industry_preset, '') <> 'handyman')
    OR (aw.name LIKE 'Plumbing:%' AND COALESCE(w.industry_preset, '') <> 'plumbing')
    OR (aw.name LIKE 'Electrical:%' AND COALESCE(w.industry_preset, '') <> 'electrician')
    OR (
      aw.name LIKE 'Field:%'
      AND industry_pipeline_family(w.industry_preset) IS DISTINCT FROM 'field'
    )
  );
