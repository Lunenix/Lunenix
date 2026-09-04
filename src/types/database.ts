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
  industry_custom_label?: string | null;
  phone?: string | null;
  team_size?: string | null;
  max_seats?: number;
  tier?: string;
  trial_ends_at?: string | null;
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
  extra_workspace_slots?: number;
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
  archived_at?: string | null;
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
  source: string | null;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
  contact?: Contact | null;
}

export function isArchived(row: { archived_at?: string | null }): boolean {
  return Boolean(row.archived_at);
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
  estimate_id?: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  due_date: string | null;
  budget: number | null;
  currency: string;
  assignee_id?: string | null;
  address?: string | null;
  urgent?: boolean;
  route_position?: number | null;
  weather_hold?: boolean;
  weather_hold_reason?: string | null;
  work_phase?: string | null;
  inspection_phase?: string | null;
  closing_on?: string | null;
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
  stripe_payment_link_id?: string | null;
  stripe_payment_url?: string | null;
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

export type EstimateStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "approved"
  | "expired"
  | "declined";

export interface EstimateLineItem {
  description: string;
  quantity?: number;
  unit_price?: number;
  amount: number;
}

export interface Estimate {
  id: string;
  workspace_id: string;
  contact_id: string;
  lead_id: string | null;
  visit_task_id: string | null;
  project_id: string | null;
  title: string;
  job_type: string | null;
  notes: string | null;
  address: string | null;
  visit_at: string | null;
  status: EstimateStatus;
  valid_until: string | null;
  line_items: EstimateLineItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  currency: string;
  sent_at: string | null;
  viewed_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  contact?: Contact | null;
  photos?: EstimatePhoto[];
}

export interface EstimatePhoto {
  id: string;
  workspace_id: string;
  estimate_id: string;
  file_url: string;
  caption: string | null;
  kind?: "photo" | "drone" | "measurement" | "video" | "surface" | "swatch" | "prep" | "infestation" | "entry_point" | "finding" | "thermal" | "moisture";
  created_at: string;
}

export type InsuranceClaimStatus =
  | "filed"
  | "adjuster_scheduled"
  | "approved"
  | "denied"
  | "supplement_pending"
  | "paid"
  | "closed";

export interface InsuranceClaim {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  project_id: string | null;
  estimate_id: string | null;
  lead_id: string | null;
  insurance_company: string | null;
  policy_number: string | null;
  claim_number: string | null;
  status: InsuranceClaimStatus;
  pricing_mode: "insurance" | "out_of_pocket";
  adjuster_name: string | null;
  adjuster_phone: string | null;
  adjuster_email: string | null;
  adjuster_at: string | null;
  scope_notes: string | null;
  supplement_notes: string | null;
  acv_amount: number | null;
  depreciation_amount: number | null;
  acv_paid_on: string | null;
  depreciation_paid_on: string | null;
  notes: string | null;
  created_at: string;
  contact?: Contact | null;
  project?: { id: string; name: string } | null;
}

export type MaterialOrderStatus =
  | "needed"
  | "ordered"
  | "in_transit"
  | "delivered"
  | "delayed"
  | "cancelled";

export interface MaterialOrder {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  project_id: string | null;
  name: string;
  material_type: "shingles" | "underlayment" | "dumpster" | "other";
  color: string | null;
  quantity: string | null;
  vendor: string | null;
  status: MaterialOrderStatus;
  delivery_on: string | null;
  dropoff_notes: string | null;
  notes: string | null;
  created_at: string;
  project?: { id: string; name: string } | null;
}

export interface TechnicianProfile {
  id: string;
  workspace_id: string;
  user_id: string;
  available: boolean;
  certifications: string | null;
  license_expires: string | null;
  eo_expires?: string | null;
  ce_due_on?: string | null;
  notes: string | null;
}

export interface InventoryItem {
  id: string;
  workspace_id: string;
  name: string;
  sku: string | null;
  quantity: number;
  reorder_at: number;
  unit: string;
  calibrated_on?: string | null;
  next_service_on?: string | null;
}

export interface JobExpense {
  id: string;
  workspace_id: string;
  project_id: string | null;
  contact_id: string | null;
  category: string;
  amount: number;
  vendor: string | null;
  receipt_url: string | null;
  notes: string | null;
  incurred_on: string;
}

export interface MileageLog {
  id: string;
  workspace_id: string;
  project_id: string | null;
  contact_id: string | null;
  user_id: string | null;
  driven_on: string;
  miles: number;
  rate_per_mile: number;
  amount: number;
  origin: string | null;
  destination: string | null;
  purpose: string | null;
  notes: string | null;
  created_at: string;
  project?: { id: string; name: string } | null;
  contact?: Contact | null;
}

export interface VendorBill {
  id: string;
  workspace_id: string;
  vendor_name: string;
  amount: number;
  due_date: string | null;
  status: "pending" | "paid";
  paid_at: string | null;
  notes: string | null;
}

export interface CustomerEquipment {
  id: string;
  workspace_id: string;
  contact_id: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial: string | null;
  installed_on: string | null;
  notes: string | null;
}

export type JobPermitStatus =
  | "needed"
  | "applied"
  | "pulled"
  | "approved"
  | "inspection_scheduled"
  | "passed"
  | "failed"
  | "not_required";

export interface JobPermit {
  id: string;
  workspace_id: string;
  project_id: string | null;
  contact_id: string | null;
  name: string;
  permit_number: string | null;
  kind?: "city" | "hoa" | "other";
  status: JobPermitStatus;
  pulled_on: string | null;
  approved_on: string | null;
  inspection_on: string | null;
  notes: string | null;
  created_at: string;
  project?: { id: string; name: string } | null;
}

export type ServicePlanFrequency =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "seasonal";

export interface ServicePlan {
  id: string;
  workspace_id: string;
  contact_id: string;
  project_id: string | null;
  name: string;
  frequency: ServicePlanFrequency;
  seasonal_on: boolean;
  next_visit_on: string;
  skip_until?: string | null;
  amount: number;
  auto_invoice: boolean;
  is_active: boolean;
  last_generated_on: string | null;
  notes: string | null;
  created_at: string;
  contact?: Pick<
    Contact,
    "id" | "first_name" | "last_name" | "organization_name" | "type" | "email"
  > | null;
}

export interface JobFinishSpec {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  project_id: string | null;
  room_or_surface: string;
  brand: string | null;
  color_name: string | null;
  color_code: string | null;
  sheen: string | null;
  quantity: string | null;
  supplier: string | null;
  match_notes: string | null;
  client_signed_off_at: string | null;
  notes: string | null;
  created_at: string;
  project?: { id: string; name: string } | null;
  contact?: Pick<
    Contact,
    "id" | "first_name" | "last_name" | "organization_name" | "type" | "email"
  > | null;
}

export interface JobPrepItem {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  project_id: string | null;
  kind: string;
  status: string;
  billed_separately: boolean;
  notes: string | null;
  created_at: string;
  project?: { id: string; name: string } | null;
}

export interface HoaColorApproval {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  project_id: string | null;
  status: string;
  scheme_notes: string | null;
  notes: string | null;
  submitted_on: string | null;
  decided_on: string | null;
  created_at: string;
  project?: { id: string; name: string } | null;
}

export interface PestTreatment {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  project_id: string | null;
  product_name: string;
  epa_number: string | null;
  method: string;
  quantity: string | null;
  target_pest: string | null;
  treatment_area: string | null;
  treated_on: string;
  guarantee_days: number | null;
  retreatment_until: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  project?: { id: string; name: string } | null;
  contact?: Pick<
    Contact,
    "id" | "first_name" | "last_name" | "organization_name" | "type" | "email"
  > | null;
}

export interface PropertyAccess {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  project_id: string | null;
  entry_method: string;
  has_entry_code: boolean;
  entry_code: string | null;
  pets_notes: string | null;
  child_safety: string | null;
  chemical_sensitive: string | null;
  special_instructions: string | null;
  notes: string | null;
  created_at: string;
  contact?: Pick<
    Contact,
    "id" | "first_name" | "last_name" | "organization_name" | "type" | "email"
  > | null;
  project?: { id: string; name: string } | null;
}

export interface InspectionFinding {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  project_id: string | null;
  system: string;
  title: string;
  notes: string | null;
  severity: string;
  moisture_reading: string | null;
  thermal_notes: string | null;
  photo_url: string | null;
  status: string;
  created_at: string;
  project?: { id: string; name: string } | null;
  contact?: Pick<
    Contact,
    "id" | "first_name" | "last_name" | "organization_name" | "type" | "email"
  > | null;
}

export interface InspectionReport {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  project_id: string | null;
  title: string;
  summary: string | null;
  agent_name: string | null;
  seller_agent_name: string | null;
  property_type: string | null;
  property_size: string | null;
  closing_on: string | null;
  due_at: string | null;
  walkthrough_at: string | null;
  share_token: string;
  status: string;
  ready_at: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  downloaded_at: string | null;
  notes: string | null;
  created_at: string;
  project?: { id: string; name: string } | null;
  contact?: Pick<
    Contact,
    "id" | "first_name" | "last_name" | "organization_name" | "type" | "email"
  > | null;
}

export interface InspectionAddon {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  project_id: string | null;
  kind: string;
  status: string;
  specialist_name: string | null;
  result_summary: string | null;
  due_on: string | null;
  notes: string | null;
  created_at: string;
  project?: { id: string; name: string } | null;
}

export interface RentalAsset {
  id: string;
  workspace_id: string;
  name: string;
  sku: string | null;
  category: string;
  location: string;
  status: string;
  hourly_rate: number;
  daily_rate: number;
  weekly_rate: number;
  purchase_cost: number | null;
  purchased_on: string | null;
  hours_used: number;
  service_interval_hours: number | null;
  last_serviced_on: string | null;
  next_service_on: string | null;
  fuel_level: string | null;
  last_known_location: string | null;
  notes: string | null;
  created_at: string;
}

export interface RentalReservation {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  asset_id: string | null;
  estimate_id: string | null;
  starts_on: string;
  ends_on: string;
  pickup_method: string;
  job_site_address: string | null;
  status: string;
  rate_type: string;
  rate_amount: number;
  deposit_amount: number;
  damage_waiver: boolean;
  late_fee: number;
  damage_charge: number;
  account_terms: string | null;
  checked_out_on: string | null;
  returned_on: string | null;
  notes: string | null;
  created_at: string;
  asset?: { id: string; name: string; daily_rate?: number } | null;
  contact?: Pick<
    Contact,
    "id" | "first_name" | "last_name" | "organization_name" | "type" | "email"
  > | null;
  logs?: RentalConditionLog[];
}

export interface RentalConditionLog {
  id: string;
  workspace_id: string;
  reservation_id: string | null;
  asset_id: string | null;
  kind: string;
  photo_url: string | null;
  fuel_level: string | null;
  notes: string | null;
  logged_on: string;
}

export interface RentalMaintenance {
  id: string;
  workspace_id: string;
  asset_id: string | null;
  title: string;
  status: string;
  hours_at_service: number | null;
  cost: number | null;
  due_on: string | null;
  completed_on: string | null;
  notes: string | null;
  created_at: string;
  asset?: { id: string; name: string } | null;
}

export interface ConstructionChangeOrder {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  project_id: string | null;
  title: string;
  status: string;
  cost_impact: number;
  notes: string | null;
  created_at: string;
  project?: { id: string; name: string } | null;
}

export interface ConstructionSub {
  id: string;
  workspace_id: string;
  name: string;
  trade: string;
  phone: string | null;
  email: string | null;
  coi_expires: string | null;
  license_expires: string | null;
  rate_notes: string | null;
  notes: string | null;
  created_at: string;
}

export interface ConstructionPhase {
  id: string;
  workspace_id: string;
  project_id: string | null;
  sub_id: string | null;
  kind: string;
  status: string;
  percent_complete: number;
  delay_cause: string | null;
  depends_on: string | null;
  starts_on: string | null;
  ends_on: string | null;
  notes: string | null;
  created_at: string;
  project?: { id: string; name: string } | null;
  sub?: { id: string; name: string } | null;
}

export interface ConstructionDailyLog {
  id: string;
  workspace_id: string;
  project_id: string | null;
  logged_on: string;
  weather: string | null;
  crew_notes: string | null;
  work_completed: string | null;
  issues: string | null;
  safety_notes: string | null;
  photo_url: string | null;
  created_at: string;
  project?: { id: string; name: string } | null;
}

export interface ConstructionDraw {
  id: string;
  workspace_id: string;
  project_id: string | null;
  kind: string;
  status: string;
  amount: number;
  percent_complete: number;
  due_on: string | null;
  lien_waiver: string;
  notes: string | null;
  created_at: string;
  project?: { id: string; name: string } | null;
}

export interface ShopDesign {
  id: string;
  workspace_id: string;
  project_id: string | null;
  contact_id: string | null;
  title: string;
  version: number;
  status: string;
  dimensions: string | null;
  joinery_notes: string | null;
  drawing_url: string | null;
  notes: string | null;
  created_at: string;
  project?: { id: string; name: string } | null;
}

export interface ShopSelection {
  id: string;
  workspace_id: string;
  project_id: string | null;
  kind: string;
  name: string;
  cost: number;
  photo_url: string | null;
  signed_off_at: string | null;
  notes: string | null;
  created_at: string;
  project?: { id: string; name: string } | null;
}

export interface ShopQueueItem {
  id: string;
  workspace_id: string;
  project_id: string | null;
  contact_id: string | null;
  title: string;
  stage: string;
  fab_step: string | null;
  craftsman_name: string | null;
  install_on: string | null;
  access_notes: string | null;
  notes: string | null;
  created_at: string;
  project?: { id: string; name: string } | null;
}

export interface SteelDrawing {
  id: string;
  workspace_id: string;
  project_id: string | null;
  contact_id: string | null;
  title: string;
  version: number;
  status: string;
  pe_status: string;
  dimensions: string | null;
  weld_notes: string | null;
  drawing_url: string | null;
  notes: string | null;
  created_at: string;
  project?: { id: string; name: string } | null;
}

export interface SteelSpec {
  id: string;
  workspace_id: string;
  project_id: string | null;
  metal: string;
  finish: string;
  thickness: string | null;
  name: string;
  cost: number;
  quote_valid_until: string | null;
  signed_off_at: string | null;
  notes: string | null;
  created_at: string;
  project?: { id: string; name: string } | null;
}

export interface SteelQueueItem {
  id: string;
  workspace_id: string;
  project_id: string | null;
  contact_id: string | null;
  title: string;
  stage: string;
  fab_step: string | null;
  fabricator_name: string | null;
  install_on: string | null;
  access_notes: string | null;
  notes: string | null;
  created_at: string;
  project?: { id: string; name: string } | null;
}

export interface BarEvent {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  project_id: string | null;
  title: string;
  event_on: string | null;
  venue_name: string | null;
  venue_address: string | null;
  guest_count: number | null;
  deposit_paid: boolean;
  retainer_amount: number;
  event_type: string;
  lead_source: string | null;
  package_tier: string;
  consult_at: string | null;
  consult_kind: string;
  hours: number | null;
  addons: string | null;
  load_in_at: string | null;
  event_start_at: string | null;
  event_end_at: string | null;
  breakdown_at: string | null;
  staff_notes: string | null;
  equipment_checklist: string | null;
  venue_access: string | null;
  theme_colors: string | null;
  must_haves: string | null;
  avoid_items: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface BarMenu {
  id: string;
  workspace_id: string;
  name: string;
  package_tier: string;
  setup_style: string;
  cocktails: string | null;
  mocktails: string | null;
  dietary_notes: string | null;
  garnish_notes: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface BarLook {
  id: string;
  workspace_id: string;
  kind: string;
  title: string;
  image_url: string | null;
  venue_photo_url: string | null;
  client_status: string;
  notes: string | null;
  created_at: string;
}

export interface BarCompliance {
  id: string;
  workspace_id: string;
  kind: string;
  name: string;
  holder_name: string | null;
  expires_on: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface BarSupplyOrder {
  id: string;
  workspace_id: string;
  vendor_name: string;
  kind: string;
  status: string;
  pickup_on: string | null;
  leftover_notes: string | null;
  notes: string | null;
  created_at: string;
}

export interface BarCrew {
  id: string;
  workspace_id: string;
  name: string;
  role: string;
  tips_expires_on: string | null;
  food_handler_expires_on: string | null;
  rating: number | null;
  notes: string | null;
  created_at: string;
}

export interface BarOnsite {
  id: string;
  workspace_id: string;
  kind: string;
  title: string;
  image_url: string | null;
  incident_kind: string | null;
  notes: string | null;
  created_at: string;
}

export interface PlannerEvent {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  project_id: string | null;
  title: string;
  event_on: string | null;
  venue_name: string | null;
  venue_address: string | null;
  guest_count: number | null;
  event_type: string;
  lead_source: string | null;
  planning_tier: string;
  addons: string | null;
  budget_range: string | null;
  budget_total: number | null;
  deposit_paid: boolean;
  retainer_amount: number;
  consult_at: string | null;
  theme_colors: string | null;
  must_haves: string | null;
  avoid_items: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface VenueBooking {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  project_id: string | null;
  title: string;
  space_name: string | null;
  event_on: string | null;
  event_type: string;
  lead_source: string | null;
  guest_count: number | null;
  rental_tier: string;
  included_items: string | null;
  addons: string | null;
  hours: number | null;
  overtime_rate: number | null;
  tour_at: string | null;
  load_in_at: string | null;
  event_start_at: string | null;
  event_end_at: string | null;
  load_out_at: string | null;
  access_notes: string | null;
  staff_notes: string | null;
  vendor_windows: string | null;
  deposit_paid: boolean;
  retainer_amount: number;
  damage_deposit_amount: number;
  damage_deposit_status: string;
  date_held: boolean;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface BridalItem {
  id: string;
  workspace_id: string;
  title: string;
  tag_code: string | null;
  kind: string;
  style_name: string | null;
  size: string | null;
  color: string | null;
  designer: string | null;
  price: number | null;
  cost: number | null;
  qty: number;
  reorder_below: number | null;
  status: string;
  rack: string | null;
  section: string | null;
  hanger: string | null;
  location_label: string | null;
  sample_sale: boolean;
  notes: string | null;
  created_at: string;
}

export interface CateringEvent {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  title: string;
  event_on: string | null;
  venue_name: string | null;
  guest_count: number | null;
  service_style: string;
  status: string;
  food_cost: number | null;
  package_price: number | null;
  notes: string | null;
  created_at: string;
}

export interface ChefVisit {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  title: string;
  visit_on: string | null;
  starts_at: string | null;
  service_type: string;
  household_size: number | null;
  grocery_cost: number | null;
  chef_fee: number | null;
  status: string;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface PhotoShoot {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  title: string;
  shoot_on: string | null;
  starts_at: string | null;
  venue_name: string | null;
  shoot_type: string;
  coverage: string;
  hours: number | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface SteelWeldLog {
  id: string;
  workspace_id: string;
  project_id: string | null;
  welder_name: string;
  weld_type: string;
  joint: string | null;
  result: string;
  ndt_result: string;
  notes: string | null;
  created_at: string;
  project?: { id: string; name: string } | null;
}
