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
  primary_color?: string | null;
  portal_slug?: string | null;
  custom_domain?: string | null;
  industry_preset?: string | null;
  max_seats?: number;
  tier?: string;
}

/**
 * Per-workspace Luna AI assistant configuration.
 */
export interface WorkspaceAISettings {
  id: string;
  workspace_id: string;
  agent_name: string;
  avatar_id: string;
  avatar_url: string | null;
  voice_id: string;
  home_city: string | null;
  timezone: string | null;
  custom_instructions: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  updated_at: string | null;
}

/** Per-user alert channels. Isolated by user_id; not a workspace CRM table. */
export interface UserSettings {
  user_id: string;
  personal_phone_number: string | null;
  sms_enabled: boolean;
  updated_at: string;
}

export type WorkspaceRole = "owner" | "admin" | "member" | string;

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
}

export type ActivityActorType = "user" | "luna";

/** Tenant-scoped audit/activity row for Luna context and workspace history. */
export interface ActivityLog {
  id: string;
  workspace_id: string;
  actor_type: ActivityActorType;
  action: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface KnowledgeBaseEntry {
  id: string;
  workspace_id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
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
  contact_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  due_date: string | null;
  reminder_minutes_before: number | null;
  reminder_sent_at: string | null;
  position: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // Optional relation for cross-workspace task views.
  project?: Pick<Project, "id" | "name"> | null;
  contact?: Pick<
    Contact,
    "id" | "type" | "first_name" | "last_name" | "organization_name" | "email"
  > | null;
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

// ---------------------------------------------------------------------------
// Phase 5 tables: Forms + Questionnaires
// ---------------------------------------------------------------------------

export type FormStatus = "draft" | "active" | "archived";

export type FormFieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "select"
  | "radio"
  | "checkbox";

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[]; // For select, radio, checkbox
}

export interface Form {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  status: FormStatus;
  fields: FormField[];
  submit_button_text: string;
  success_message: string;
  allow_multiple_submissions: boolean;
  slug: string | null;
  created_at: string;
  updated_at: string;
}

export interface FormSubmission {
  id: string;
  form_id: string;
  workspace_id: string;
  contact_id: string | null;
  submitted_data: Record<string, string | string[] | number | boolean>;
  submitted_at: string;
  ip_address: string | null;
  user_agent: string | null;
  auto_created_contact: boolean;
  // Optional relations for list + detail views.
  form?: Pick<Form, "id" | "name" | "fields"> | null;
  contact?: Contact | null;
}

// Labels + badge styling helpers for forms.
export const FORM_STATUS_LABELS: Record<FormStatus, string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
};

export const FORM_FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: "Short Text",
  textarea: "Long Text",
  email: "Email",
  phone: "Phone",
  number: "Number",
  date: "Date",
  select: "Dropdown",
  radio: "Multiple Choice",
  checkbox: "Checkboxes",
};

// ---------------------------------------------------------------------------
// Phase 6 tables: Emails + Automation
// ---------------------------------------------------------------------------

export interface TemplateVariable {
  key: string;
  label: string;
  description: string;
}

export interface EmailTemplate {
  id: string;
  workspace_id: string;
  name: string; // internal label / title
  subject: string; // subject line (may contain smart-field tokens)
  body: string; // HTML content (may contain smart-field tokens)
  variables: TemplateVariable[];
  /** Seeded template used by workflow triggers. Editable but NOT deletable. */
  is_system_default: boolean;
  /** Stable key for a system trigger template, e.g. "invoice_sent". */
  template_key: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * A queued manual send scheduled for a future time.
 */
export type ScheduledEmailStatus = "scheduled" | "sent" | "failed" | "cancelled";

export interface ScheduledEmailAttachment {
  filename: string;
  content: string; // base64
}

export interface ScheduledEmail {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  project_id: string | null;
  template_id: string | null;
  to_email: string;
  to_name: string | null;
  subject: string;
  body_html: string;
  attachments: ScheduledEmailAttachment[];
  scheduled_for: string;
  status: ScheduledEmailStatus;
  error: string | null;
  created_by: string | null;
  created_at: string;
  sent_at: string | null;
}

export type EmailStatus = "pending" | "sent" | "failed";

export type EmailDraftStatus = "draft" | "scheduled" | "sent" | "failed" | "archived";

export interface EmailDraft {
  id: string;
  workspace_id: string;
  recipient_email: string;
  subject: string;
  body_text: string;
  status: EmailDraftStatus;
  scheduled_at: string | null;
  created_at: string;
}

export interface EmailLog {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  template_id: string | null;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  body: string; // HTML content
  status: EmailStatus;
  error_message: string | null;
  sent_at: string;
  sent_by: string | null;
  // Optional relations for list + detail views.
  contact?: Contact | null;
  template?: Pick<EmailTemplate, "id" | "name"> | null;
}

export type EmailProvider = "resend" | "smtp";

export interface EmailSettings {
  id: string;
  workspace_id: string;
  from_email: string | null;
  from_name: string | null;
  reply_to: string | null;
  provider: EmailProvider;
  // Outgoing SMTP
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: boolean;
  smtp_username: string | null;
  // Incoming IMAP
  imap_enabled: boolean;
  imap_host: string | null;
  imap_port: number | null;
  imap_secure: boolean;
  imap_username: string | null;
  imap_last_synced_at: string | null;
  imap_last_error: string | null;
  // Default signature (rich text) appended to manual sends.
  signature_html: string | null;
  // External booking / scheduling link resolved by {{scheduler.link}}.
  scheduler_url: string | null;
  // Server-derived flags (passwords themselves are never sent to the client).
  has_smtp_password?: boolean;
  has_imap_password?: boolean;
  created_at: string;
  updated_at: string;
}

export interface InboundEmail {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  message_id: string | null;
  imap_uid: number | null;
  from_email: string;
  from_name: string | null;
  to_email: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  received_at: string;
  is_read: boolean;
  created_at: string;
  contact?: Contact | null;
}

export type AutomationTriggerType =
  | "form_submission"
  | "lead_stage_change"
  | "contact_created"
  | "task_completed"
  | "invoice_sent"
  | "contract_signed";

export type AutomationActionType =
  | "send_email"
  | "create_task"
  | "update_contact"
  | "move_lead"
  | "delay";

export interface AutomationAction {
  type: AutomationActionType;
  config: Record<string, unknown>;
}

export interface AutomationWorkflow {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_type: AutomationTriggerType;
  trigger_config: Record<string, unknown>;
  actions: AutomationAction[];
  created_at: string;
  updated_at: string;
}

export type AutomationLogStatus = "success" | "failed" | "partial";

export interface AutomationActionResult {
  action_type: string;
  status: string;
  error?: string;
}

export interface AutomationLog {
  id: string;
  workflow_id: string;
  workspace_id: string;
  trigger_data: Record<string, unknown>;
  status: AutomationLogStatus;
  error_message: string | null;
  action_results: AutomationActionResult[];
  executed_at: string;
  // Optional relation for list + detail views.
  workflow?: Pick<AutomationWorkflow, "id" | "name"> | null;
}

// Labels + badge styling helpers for emails and automation.
export const EMAIL_STATUS_LABELS: Record<EmailStatus, string> = {
  pending: "Pending",
  sent: "Sent",
  failed: "Failed",
};

export const AUTOMATION_TRIGGER_LABELS: Record<AutomationTriggerType, string> = {
  form_submission: "Form Submission",
  lead_stage_change: "Lead Stage Change",
  contact_created: "Contact Created",
  task_completed: "Task Completed",
  invoice_sent: "Invoice Sent",
  contract_signed: "Contract Signed",
};

export const AUTOMATION_ACTION_LABELS: Record<AutomationActionType, string> = {
  send_email: "Send Email",
  create_task: "Create Task",
  update_contact: "Update Contact",
  move_lead: "Move Lead",
  delay: "Delay",
};

export const AUTOMATION_LOG_STATUS_LABELS: Record<AutomationLogStatus, string> = {
  success: "Success",
  failed: "Failed",
  partial: "Partial",
};



// ============================================
// E-SIGNATURE MODULE
// ============================================

export type EsignDocumentType = "contract" | "sub_agreement";

export type EsignDocumentStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "signed"
  | "countersigned"
  | "void";

export type EsignFieldType =
  | "signature"
  | "initials"
  | "date"
  | "text"
  | "name";

export type EsignAssignedTo = "client" | "owner";

export interface EsignField {
  id: string;
  document_id: string;
  page: number;
  field_type: EsignFieldType;
  // Normalized geometry (0..1), origin top-left of the page.
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  assigned_to: EsignAssignedTo;
  required: boolean;
  placeholder: string | null;
  value: string | null;
  created_at: string;
}

// Field payload used before it is persisted (no id yet).
export type EsignFieldInput = Omit<EsignField, "id" | "document_id" | "created_at"> & {
  id?: string;
};

export interface EsignSignature {
  id: string;
  document_id: string;
  signer_name: string;
  signer_email: string | null;
  signature_type: "typed" | "drawn";
  signature_data: string;
  role: EsignAssignedTo;
  ip_address: string | null;
  user_agent: string | null;
  signed_at: string;
}

export type EsignEventType =
  | "created"
  | "sent"
  | "viewed"
  | "signed"
  | "countersigned"
  | "void"
  | "downloaded"
  | "reminded";

export interface EsignEvent {
  id: string;
  document_id: string;
  event_type: EsignEventType;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type EsignContentType = "uploaded_pdf" | "editable_document";

export interface EsignDocument {
  id: string;
  workspace_id: string;
  project_id: string | null;
  contact_id: string | null;
  name: string;
  type: EsignDocumentType;
  status: EsignDocumentStatus;
  original_file_path: string | null;
  signed_file_path: string | null;
  page_count: number;
  sign_token: string | null;
  signer_name: string | null;
  signer_email: string | null;
  assigned_workflow_id: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  countersigned_at: string | null;
  reminders_enabled: boolean;
  reminder_count: number;
  last_reminder_at: string | null;
  cloned_from: string | null;
  contract_number: string | null;
  // Business/contract metadata (folded in from the former standalone contracts module).
  value: number | null;
  currency: string | null;
  start_date: string | null;
  end_date: string | null;
  terms: string | null;
  description: string | null;
  // Editable content support (migration 0012).
  content: string | null;
  content_type: EsignContentType;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Optional relations
  contact?: Contact | null;
  project?: Pick<Project, "id" | "name"> | null;
  fields?: EsignField[];
  signatures?: EsignSignature[];
  events?: EsignEvent[];
  assigned_workflow?: Pick<AutomationWorkflow, "id" | "name"> | null;
}

export const ESIGN_STATUS_LABELS: Record<EsignDocumentStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  signed: "Signed",
  countersigned: "Countersigned",
  void: "Void",
};

export const ESIGN_TYPE_LABELS: Record<EsignDocumentType, string> = {
  contract: "Contract",
  sub_agreement: "Sub-Agreement",
};

export const ESIGN_FIELD_LABELS: Record<EsignFieldType, string> = {
  signature: "Signature",
  initials: "Initials",
  date: "Date",
  text: "Text",
  name: "Full Name",
};
