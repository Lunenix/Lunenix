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
// Phase 2 tables: Contacts + Pipeline
// ---------------------------------------------------------------------------

export type ContactType = "person" | "organization" | "lead";

export interface Contact {
  id: string;
  workspace_id: string;
  type: ContactType;
  first_name: string | null;
  last_name: string | null;
  organization_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  avatar_url: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface Pipeline {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  workspace_id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
}

export interface Lead {
  id: string;
  workspace_id: string;
  pipeline_id: string;
  stage_id: string;
  contact_id: string | null;
  title: string;
  value: number | null;
  currency: string;
  notes: string | null;
  position: number;
  expected_close_date: string | null;
  created_at: string;
  updated_at: string;
  contact?: Contact | null;
}

/**
 * Helper to produce a human-readable display name for a contact.
 */
export function contactDisplayName(c: Pick<Contact, "type" | "first_name" | "last_name" | "organization_name" | "email">): string {
  if (c.type === "organization" && c.organization_name) return c.organization_name;
  const full = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (c.organization_name) return c.organization_name;
  return c.email || "Unnamed contact";
}

// ---------------------------------------------------------------------------
// Placeholder types for future tables (Phase 3+). Minimal for now.
// ---------------------------------------------------------------------------

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
