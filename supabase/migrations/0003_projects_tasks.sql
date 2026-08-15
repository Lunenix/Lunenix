-- Phase 3: Projects/Jobs + Tasks schema
-- PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','active','on_hold','completed','cancelled')),
  start_date date,
  due_date date,
  budget numeric(12,2),
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_members_projects" ON public.projects;
CREATE POLICY "workspace_members_projects" ON public.projects
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

-- TASKS TABLE
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date date,
  position integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_members_tasks" ON public.tasks;
CREATE POLICY "workspace_members_tasks" ON public.tasks
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

-- updated_at triggers (set_updated_at() already exists from Phase 2)
DROP TRIGGER IF EXISTS projects_updated_at ON public.projects;
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS tasks_updated_at ON public.tasks;
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
