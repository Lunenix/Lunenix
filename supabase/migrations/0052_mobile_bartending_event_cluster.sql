-- Mobile Bartending is Event & Wedding via workspaces.industry_preset
-- (industry_pipeline_family = 'event', catalog sector event_wedding).
-- Do not add industry_group / industry_category (no second industries model).
-- Do not GIN-index contacts.metadata (that column does not exist).

UPDATE public.workspaces
SET industry_preset = 'mobile_bartending'
WHERE industry_preset IS NOT NULL
  AND industry_preset IS DISTINCT FROM 'mobile_bartending'
  AND (
    industry_preset IN ('mobile_bar', 'mobile bartending', 'bartending')
    OR industry_preset ILIKE '%bartending%'
  );
