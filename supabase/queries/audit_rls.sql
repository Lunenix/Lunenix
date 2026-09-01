-- Check which public tables have Row Level Security enabled.
-- Run in the Supabase SQL editor. Not a schema migration.
-- Every tenant table should show rowsecurity = true.

SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity ASC, tablename;

-- Tables still missing RLS (empty if all tenant tables are locked down):
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false
ORDER BY tablename;
