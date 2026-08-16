/**
 * Server-side builder for a SmartFieldContext.
 *
 * Given a workspace and any of a contact / project / invoice / contract / form,
 * this fetches the live records and assembles the context object that
 * resolveSmartFields() consumes — including the action-link URLs.
 *
 * Runs on the server only (uses the admin Supabase client so it works from
 * public/unauthenticated trigger contexts too). Always scoped by workspace_id.
 */

import { createAdminClient } from "@/lib/supabase/server";
import { contactDisplayName } from "@/types/database";
import { formatCurrency, formatDate } from "@/lib/format";
import type { SmartFieldContext } from "@/lib/email/smartFields";

export interface BuildContextInput {
  workspaceId: string;
  contactId?: string | null;
  projectId?: string | null;
  invoiceId?: string | null;
  contractId?: string | null;
  formId?: string | null;
  /** Absolute base URL of the app for building links (from getAppBaseUrl). */
  baseUrl: string;
  /** Optional pre-known sending user's display name. */
  userName?: string | null;
}

const stripTrailingSlash = (u: string) => u.replace(/\/$/, "");

export async function buildTemplateContext(
  input: BuildContextInput
): Promise<SmartFieldContext> {
  const supabase = createAdminClient();
  const base = stripTrailingSlash(input.baseUrl);
  const context: SmartFieldContext = {};

  // Workspace
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("id", input.workspaceId)
    .single();
  if (workspace) context.workspace = { name: workspace.name };

  // Email settings (for the scheduler / booking link)
  const { data: settings } = await supabase
    .from("email_settings")
    .select("scheduler_url")
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();
  context.scheduler = { link: settings?.scheduler_url ?? null };

  // Contact ("client")
  let contactId = input.contactId ?? null;

  // Project (may also supply the contact_id)
  if (input.projectId) {
    const { data: project } = await supabase
      .from("projects")
      .select("id, name, status, start_date, due_date, contact_id")
      .eq("id", input.projectId)
      .eq("workspace_id", input.workspaceId)
      .maybeSingle();
    if (project) {
      context.project = {
        name: project.name,
        status: project.status,
        start_date: formatDate(project.start_date),
        due_date: formatDate(project.due_date),
      };
      if (!contactId && project.contact_id) contactId = project.contact_id;
    }
  }

  // Invoice
  if (input.invoiceId) {
    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, invoice_number, status, due_date, total, currency, contact_id")
      .eq("id", input.invoiceId)
      .eq("workspace_id", input.workspaceId)
      .maybeSingle();
    if (invoice) {
      context.invoice = {
        number: invoice.invoice_number,
        total: formatCurrency(invoice.total, invoice.currency || "USD"),
        status: invoice.status,
        due_date: formatDate(invoice.due_date),
        // Invoices are dashboard-only (login required) — no public pay page.
        link: `${base}/invoices/${invoice.id}`,
      };
      if (!contactId && invoice.contact_id) contactId = invoice.contact_id;
    }
  }

  // Contract (e-sign document) — public signing link via sign_token
  if (input.contractId) {
    const { data: contract } = await supabase
      .from("esign_documents")
      .select("id, name, status, sign_token, contact_id")
      .eq("id", input.contractId)
      .eq("workspace_id", input.workspaceId)
      .maybeSingle();
    if (contract) {
      context.contract = {
        name: contract.name,
        status: contract.status,
        link: contract.sign_token ? `${base}/sign/${contract.sign_token}` : null,
      };
      if (!contactId && contract.contact_id) contactId = contract.contact_id;
    }
  }

  // Form — public link via /f/{id}
  if (input.formId) {
    const { data: form } = await supabase
      .from("forms")
      .select("id, name")
      .eq("id", input.formId)
      .eq("workspace_id", input.workspaceId)
      .maybeSingle();
    if (form) {
      context.form = { link: `${base}/f/${form.id}` };
    }
  }

  // Resolve the contact last (it may have been discovered via project/invoice/contract)
  if (contactId) {
    const { data: contact } = await supabase
      .from("contacts")
      .select(
        "id, type, first_name, last_name, organization_name, email, phone"
      )
      .eq("id", contactId)
      .eq("workspace_id", input.workspaceId)
      .maybeSingle();
    if (contact) {
      context.client = {
        first_name: contact.first_name,
        last_name: contact.last_name,
        name: contactDisplayName(contact),
        email: contact.email,
        phone: contact.phone,
        organization: contact.organization_name,
      };
    }
  }

  if (input.userName) context.user = { name: input.userName };

  return context;
}
