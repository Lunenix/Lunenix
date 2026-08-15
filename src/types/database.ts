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
// Phase 3 tables: Projects/Jobs + Tasks
// ---------------------------------------------------------------------------

export type ProjectStatus =
  | "planning"
  | "active"
  | "on_hold"
  | "completed"
  | "cancelled";

export interface Project {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  lead_id: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  due_date: string | null;
  budget: number | null;
  currency: string;
  created_at: string;
  updated_at: string;
  // Optional relations / computed fields for list + detail views.
  contact?: Contact | null;
  task_count?: number;
  open_task_count?: number;
}

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
  workspace_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  due_date: string | null;
  position: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // Optional relation for cross-workspace task views.
  project?: Pick<Project, "id" | "name"> | null;
}

// Labels + badge styling helpers shared across project/task UIs.
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

// ---------------------------------------------------------------------------
// Phase 4 tables: Contracts + Invoices
// ---------------------------------------------------------------------------

export type ContractStatus = 
  | "draft" 
  | "sent" 
  | "active" 
  | "completed" 
  | "cancelled";

export interface Contract {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  project_id: string | null;
  contract_number: string;
  name: string;
  description: string | null;
  status: ContractStatus;
  start_date: string | null;
  end_date: string | null;
  signed_at: string | null;
  value: number | null;
  currency: string;
  terms: string | null;
  created_at: string;
  updated_at: string;
  // Optional relations for list + detail views.
  contact?: Contact | null;
  project?: Pick<Project, "id" | "name"> | null;
}

export type InvoiceStatus = 
  | "draft" 
  | "sent" 
  | "paid" 
  | "overdue" 
  | "cancelled";

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface Invoice {
  id: string;
  workspace_id: string;
  contact_id: string;
  contract_id: string | null;
  project_id: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  paid_at: string | null;
  line_items: InvoiceLineItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  currency: string;
  notes: string | null;
  payment_terms: string | null;
  created_at: string;
  updated_at: string;
  // Optional relations for list + detail views.
  contact?: Contact | null;
  contract?: Pick<Contract, "id" | "contract_number" | "name"> | null;
  project?: Pick<Project, "id" | "name"> | null;
}

// Labels + badge styling helpers for contracts and invoices.
export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};
