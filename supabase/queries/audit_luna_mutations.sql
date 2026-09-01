-- Audit recent CRM rows Luna (or anyone) may have created.
-- Contacts do not have a `name` column; use first/last/organization.
-- Run in the Supabase SQL editor. Not a schema migration.

SELECT
  'contact' AS entity,
  id,
  COALESCE(
    NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''),
    organization_name,
    email,
    '(unnamed)'
  ) AS detail,
  workspace_id,
  created_at
FROM public.contacts
WHERE created_at > NOW() - INTERVAL '1 hour'

UNION ALL

SELECT
  'project' AS entity,
  id,
  name AS detail,
  workspace_id,
  created_at
FROM public.projects
WHERE created_at > NOW() - INTERVAL '1 hour'

UNION ALL

SELECT
  'task' AS entity,
  id,
  title AS detail,
  workspace_id,
  created_at
FROM public.tasks
WHERE created_at > NOW() - INTERVAL '1 hour'

ORDER BY created_at DESC;
