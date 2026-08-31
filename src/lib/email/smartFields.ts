/**
 * Smart Fields — the token engine behind email templates.
 *
 * A smart field is a `{{token}}` placeholder that gets replaced with live data
 * at send time. There are two kinds:
 *
 *  1. Value fields  — e.g. {{client.first_name}} resolves to a plain string.
 *  2. Action links  — e.g. {{contract.link}} renders as a clickable button
 *     pointing at a project-specific page (contract signing, invoice, form,
 *     scheduler). Action links support custom button text with a pipe:
 *        {{contract.link|Review & Sign}}
 *
 * Missing data is NEVER dropped silently. Unresolved value fields render a
 * visible warning marker and are collected into a `warnings` array so the
 * sender can be alerted before the email goes out.
 *
 * This module is pure/isomorphic — it does no data fetching. The caller builds
 * a `SmartFieldContext` (see buildTemplateContext.ts on the server) and passes
 * it in.
 */

export type SmartFieldGroup =
  | "client"
  | "project"
  | "invoice"
  | "contract"
  | "form"
  | "scheduler"
  | "workspace"
  | "user";

export interface SmartFieldDef {
  /** The token key, e.g. "client.first_name". */
  key: string;
  /** Human label shown in the picker. */
  label: string;
  /** Grouping for the picker UI. */
  group: SmartFieldGroup;
  /** Short description of what it resolves to. */
  description: string;
  /** True when this renders as a clickable button/link. */
  isActionLink?: boolean;
  /** Default button text when no custom text is supplied. */
  defaultLinkText?: string;
}

/**
 * The registry of every smart field the UI offers. `data_source` in the spec
 * maps to the dotted `key` here (e.g. client.first_name → context.client.first_name).
 */
export const SMART_FIELDS: SmartFieldDef[] = [
  // Client (the contact on the record)
  { key: "client.first_name", label: "Client first name", group: "client", description: "Contact's first name" },
  { key: "client.last_name", label: "Client last name", group: "client", description: "Contact's last name" },
  { key: "client.name", label: "Client full name", group: "client", description: "Contact's display name" },
  { key: "client.email", label: "Client email", group: "client", description: "Contact's email address" },
  { key: "client.phone", label: "Client phone", group: "client", description: "Contact's phone number" },
  { key: "client.organization", label: "Client organization", group: "client", description: "Contact's organization name" },

  // Project
  { key: "project.name", label: "Project name", group: "project", description: "Project / job name" },
  { key: "project.status", label: "Project status", group: "project", description: "Current project status" },
  { key: "project.start_date", label: "Project start date", group: "project", description: "Project start date" },
  { key: "project.due_date", label: "Project due date", group: "project", description: "Project due date" },

  // Invoice
  { key: "invoice.number", label: "Invoice number", group: "invoice", description: "Invoice number" },
  { key: "invoice.total", label: "Invoice total", group: "invoice", description: "Invoice total amount" },
  { key: "invoice.status", label: "Invoice status", group: "invoice", description: "Invoice status" },
  { key: "invoice.due_date", label: "Invoice due date", group: "invoice", description: "Invoice due date" },
  {
    key: "invoice.link",
    label: "Invoice button",
    group: "invoice",
    description: "Button linking to the invoice",
    isActionLink: true,
    defaultLinkText: "View Invoice",
  },

  // Contract (e-sign document)
  { key: "contract.name", label: "Contract name", group: "contract", description: "Contract document name" },
  { key: "contract.status", label: "Contract status", group: "contract", description: "Contract status" },
  {
    key: "contract.link",
    label: "Contract button",
    group: "contract",
    description: "Button linking to the contract for signing",
    isActionLink: true,
    defaultLinkText: "Review & Sign",
  },

  // Form
  {
    key: "form.link",
    label: "Form button",
    group: "form",
    description: "Button linking to a form / questionnaire",
    isActionLink: true,
    defaultLinkText: "Open Form",
  },

  // Scheduler (external booking link)
  {
    key: "scheduler.link",
    label: "Scheduler button",
    group: "scheduler",
    description: "Button linking to your booking / scheduling page",
    isActionLink: true,
    defaultLinkText: "Book a Time",
  },

  // Workspace / user
  { key: "workspace.name", label: "Workspace name", group: "workspace", description: "Your workspace / business name" },
  { key: "user.name", label: "Your name", group: "user", description: "Sending user's name" },
];

export const SMART_FIELD_GROUP_LABELS: Record<SmartFieldGroup, string> = {
  client: "Client",
  project: "Project",
  invoice: "Invoice",
  contract: "Contract",
  form: "Form",
  scheduler: "Scheduler",
  workspace: "Workspace",
  user: "User",
};

const SMART_FIELD_BY_KEY: Record<string, SmartFieldDef> = SMART_FIELDS.reduce(
  (acc, f) => {
    acc[f.key] = f;
    return acc;
  },
  {} as Record<string, SmartFieldDef>
);

export function getSmartField(key: string): SmartFieldDef | undefined {
  return SMART_FIELD_BY_KEY[key];
}

export function isActionLinkKey(key: string): boolean {
  return Boolean(SMART_FIELD_BY_KEY[key]?.isActionLink);
}

/**
 * The live data used to resolve tokens. Built server-side per project/client.
 * Action-link URLs live under the same dotted key (e.g. context.contract.link).
 */
export interface SmartFieldContext {
  client?: {
    first_name?: string | null;
    last_name?: string | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    organization?: string | null;
  };
  project?: {
    name?: string | null;
    status?: string | null;
    start_date?: string | null;
    due_date?: string | null;
  };
  invoice?: {
    number?: string | null;
    total?: string | null;
    status?: string | null;
    due_date?: string | null;
    link?: string | null;
  };
  contract?: {
    name?: string | null;
    status?: string | null;
    link?: string | null;
  };
  form?: { link?: string | null };
  scheduler?: { link?: string | null };
  workspace?: { name?: string | null };
  user?: { name?: string | null };
  [key: string]: unknown;
}

export interface SmartFieldWarning {
  /** The raw token as it appeared, e.g. "{{client.first_name}}". */
  token: string;
  /** The dotted key, e.g. "client.first_name". */
  key: string;
  /** Human-readable reason. */
  message: string;
}

export interface ResolveResult {
  /** The resolved text/HTML. */
  html: string;
  /** Any tokens that could not be resolved. */
  warnings: SmartFieldWarning[];
}

export interface ResolveOptions {
  /**
   * How to render an unresolved value field:
   *  - "warn"  → insert a visible marker like [⚠ client.first_name unavailable] (default)
   *  - "empty" → render an empty string
   * Either way, the token is still collected into `warnings`.
   */
  missingBehavior?: "warn" | "empty";
  /** When true, escape action-link button text (used for HTML bodies). Default true. */
  escapeHtml?: boolean;
}

// Matches {{ key }} or {{ key | custom text }}
const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*(?:\|([^}]*))?\}\}/g;

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Look up a dotted key against the context object. */
function lookup(context: SmartFieldContext, key: string): unknown {
  const parts = key.split(".");
  let value: unknown = context;
  for (const p of parts) {
    if (value == null || typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[p];
  }
  return value;
}

/** Inline button styling that survives most email clients. */
const BUTTON_STYLE =
  "display:inline-block;padding:10px 18px;background-color:#4f46e5;color:#ffffff;" +
  "text-decoration:none;border-radius:6px;font-weight:600;font-family:inherit;";

/** Visible warning marker for an unresolved token. */
function warnMarker(key: string): string {
  return `<span style="color:#b91c1c;background:#fee2e2;padding:0 4px;border-radius:3px;">[⚠ ${escapeHtmlText(
    key
  )} unavailable]</span>`;
}

/**
 * Resolve every {{token}} in `text` against `context`.
 *
 * - Value fields resolve to their string value; missing → warning marker.
 * - Action links render as a styled anchor; missing URL → warning marker.
 * - Custom button text: {{contract.link|Review & Sign}}.
 */
export function resolveSmartFields(
  text: string,
  context: SmartFieldContext,
  options: ResolveOptions = {}
): ResolveResult {
  const missingBehavior = options.missingBehavior ?? "warn";
  const escape = options.escapeHtml ?? true;
  const warnings: SmartFieldWarning[] = [];

  if (!text) return { html: text ?? "", warnings };

  const html = text.replace(TOKEN_RE, (full, rawKey: string, rawCustom?: string) => {
    const key = rawKey.trim();
    const def = SMART_FIELD_BY_KEY[key];
    const customText = rawCustom != null ? rawCustom.trim() : undefined;

    // Unknown token — leave visible so it can be caught.
    if (!def) {
      warnings.push({ token: full, key, message: `Unknown smart field "${key}"` });
      return missingBehavior === "empty" ? "" : warnMarker(key);
    }

    const value = lookup(context, key);
    const hasValue = value != null && String(value).trim() !== "";

    if (def.isActionLink) {
      const url = hasValue ? String(value) : "";
      const label = customText && customText.length > 0 ? customText : def.defaultLinkText || "Open";
      if (!url) {
        warnings.push({
          token: full,
          key,
          message: `No link available for "${def.label}"`,
        });
        return missingBehavior === "empty" ? "" : warnMarker(key);
      }
      const safeLabel = escape ? escapeHtmlText(label) : label;
      const safeUrl = escapeHtmlText(url);
      return `<a href="${safeUrl}" style="${BUTTON_STYLE}" target="_blank" rel="noopener">${safeLabel}</a>`;
    }

    // Plain value field
    if (!hasValue) {
      warnings.push({
        token: full,
        key,
        message: `No value for "${def.label}"`,
      });
      return missingBehavior === "empty" ? "" : warnMarker(key);
    }

    const str = String(value);
    return escape ? escapeHtmlText(str) : str;
  });

  return { html, warnings };
}

/**
 * Convenience: resolve subject + body together and merge warnings.
 * Subjects are plain text, so action-link buttons in a subject fall back to
 * their URL text form is avoided — but we still resolve values there.
 */
export function resolveTemplate(
  subject: string,
  body: string,
  context: SmartFieldContext,
  options: ResolveOptions = {}
): { subject: string; body: string; warnings: SmartFieldWarning[] } {
  const subj = resolveSmartFields(subject, context, options);
  const bod = resolveSmartFields(body, context, options);
  return {
    subject: subj.html,
    body: bod.html,
    warnings: [...subj.warnings, ...bod.warnings],
  };
}

/** List all tokens actually used in a piece of text (unique keys). */
export function extractUsedTokens(text: string): string[] {
  const keys = new Set<string>();
  if (!text) return [];
  let m: RegExpExecArray | null;
  const re = new RegExp(TOKEN_RE.source, "g");
  while ((m = re.exec(text)) !== null) {
    keys.add(m[1].trim());
  }
  return Array.from(keys);
}
