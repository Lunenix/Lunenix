/**
 * TypeScript types for the Lunenix Supabase schema.
 *
 * These mirror the existing tables in the Supabase project. Do NOT alter the
 * underlying schema here — this file only describes it for the application.
 */

// ---------------------------------------------------------------------------
// Existing tables
// ---------------------------------------------------------------------------

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  logo_url: string | null;
}

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  updated_at: string | null;
}

export type WorkspaceRole = "owner" | "admin" | "member" | string;

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
}

/**
 * A workspace joined with the current user's membership row. Useful for the
 * workspace switcher, which needs both the workspace details and the role.
 */
export interface WorkspaceWithMembership extends Workspace {
  membership_role?: WorkspaceRole;
}

// ---------------------------------------------------------------------------
// Placeholder types for future tables (Phase 2+). Minimal for now.
// ---------------------------------------------------------------------------

export interface Contact {
  id: string;
  workspace_id: string;
  created_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  workspace_id: string;
  created_at: string;
}
