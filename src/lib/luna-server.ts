import "server-only";

import {
  sanitizeLunaContext,
  sanitizePayload,
  sanitizeCustomInstructions,
  formatTimeInZone,
  isIanaTimeZone,
  type WorkspaceContextPayload,
} from "@/lib/luna";
import { sendServerEmail } from "@/lib/email/sendServerEmail";
import { executeWorkflowsForTrigger } from "@/lib/automation/executeWorkflow";
import { ymdFromUnknown } from "@/lib/calendar";
import { parseReminderMinutes } from "@/lib/tasks/reminder";

/** Minimal query client. Callers pass the authenticated Supabase server client. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LunaSupabaseClient = { from: (relation: string) => any };

const PROJECT_STATUSES = new Set([
  "planning",
  "active",
  "on_hold",
  "completed",
  "cancelled",
]);
const TASK_STATUSES = new Set(["todo", "in_progress", "done"]);
const TASK_PRIORITIES = new Set(["low", "medium", "high", "urgent"]);
const WORKFLOW_TRIGGERS = new Set([
  "form_submission",
  "lead_stage_change",
  "contact_created",
  "task_completed",
  "invoice_sent",
  "contract_signed",
]);

const CONTACT_CONTEXT_KEYS = [
  "id",
  "type",
  "first_name",
  "last_name",
  "organization_name",
  "email",
  "phone",
] as const;
const PROJECT_CONTEXT_KEYS = ["id", "name", "status", "due_date"] as const;
const TASK_CONTEXT_KEYS = [
  "id",
  "title",
  "status",
  "priority",
  "due_date",
  "project_id",
] as const;

export type LunaWorkspaceContext = {
  contacts: Record<string, unknown>[];
  projects: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  openTasks: Record<string, unknown>[];
  contracts: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
  forms: Record<string, unknown>[];
  workflows: Record<string, unknown>[];
  homeCity: string | null;
  timezone: string | null;
  localTime: string | null;
};

function pickKeys(
  row: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> {
  const sliced: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in row) sliced[key] = row[key];
  }
  return sanitizeLunaContext(sliced);
}

function argString(args: Record<string, unknown>, key: string): string | null {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function argStringAny(
  args: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = argString(args, key);
    if (value) return value;
  }
  return null;
}

function argNumber(args: Record<string, unknown>, key: string): number | null {
  const value = args[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function assertLunaWorkspaceMember(
  supabase: LunaSupabaseClient,
  workspaceId: string,
  userId: string
): Promise<{ workspace_id: string; user_id: string } | null> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, user_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  const scopedWorkspaceId =
    typeof data.workspace_id === "string" ? data.workspace_id : null;
  const scopedUserId = typeof data.user_id === "string" ? data.user_id : null;
  if (!scopedWorkspaceId || !scopedUserId) return null;
  return { workspace_id: scopedWorkspaceId, user_id: scopedUserId };
}

async function findContactId(
  supabase: LunaSupabaseClient,
  workspaceId: string,
  nameOrEmail: string | null
): Promise<string | null> {
  const matches = await findContactMatches(supabase, workspaceId, nameOrEmail);
  return matches.length === 1 ? matches[0].id : matches[0]?.id ?? null;
}

async function findPipelineStage(
  supabase: LunaSupabaseClient,
  workspaceId: string,
  statusOrName: string | null
): Promise<{ id: string; name: string } | null> {
  if (!statusOrName?.trim()) return null;
  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("id, name, position")
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: true });
  const list = (stages ?? []) as Array<{ id: string; name: string }>;
  if (!list.length) return null;
  const terms = stageSearchTerms(statusOrName);
  for (const term of terms) {
    const hit = list.find((s) => s.name.toLowerCase().includes(term));
    if (hit) return { id: hit.id, name: hit.name };
  }
  return null;
}

async function resolveWorkspaceContactId(
  supabase: LunaSupabaseClient,
  workspaceId: string,
  args: Record<string, unknown>
): Promise<string | null> {
  const explicit = argStringAny(args, ["contact_id", "contactId"]);
  if (explicit) {
    const { data } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", explicit)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    return typeof data?.id === "string" ? data.id : null;
  }
  return findContactId(
    supabase,
    workspaceId,
    argString(args, "contact_name") ?? argString(args, "contact_email")
  );
}

async function findContactMatches(
  supabase: LunaSupabaseClient,
  workspaceId: string,
  nameOrEmail: string | null
): Promise<Array<{ id: string; label: string }>> {
  if (!nameOrEmail) return [];
  if (nameOrEmail.includes("@")) {
    const { data } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, organization_name, email")
      .eq("workspace_id", workspaceId)
      .ilike("email", nameOrEmail)
      .limit(5);
    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      label: contactSpokenLabel(row),
    }));
  }
  const { data } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, organization_name, email")
    .eq("workspace_id", workspaceId)
    .limit(40);
  const needle = nameOrEmail.toLowerCase().trim();
  return (data ?? [])
    .filter((row: Record<string, unknown>) => {
      const full = [row.first_name, row.last_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const org =
        typeof row.organization_name === "string"
          ? row.organization_name.toLowerCase()
          : "";
      const email =
        typeof row.email === "string" ? row.email.toLowerCase() : "";
      return full.includes(needle) || org.includes(needle) || email.includes(needle);
    })
    .map((row: Record<string, unknown>) => ({
      id: String(row.id),
      label: contactSpokenLabel(row),
    }));
}

function contactSpokenLabel(row: Record<string, unknown>): string {
  const full = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  return (
    full ||
    (typeof row.organization_name === "string" ? row.organization_name : "") ||
    (typeof row.email === "string" ? row.email : "contact")
  );
}

async function findProjectId(
  supabase: LunaSupabaseClient,
  workspaceId: string,
  name: string | null
): Promise<string | null> {
  const matches = await findProjectMatches(supabase, workspaceId, name);
  return matches.length ? matches[0].id : null;
}

async function findProjectMatches(
  supabase: LunaSupabaseClient,
  workspaceId: string,
  name: string | null
): Promise<Array<{ id: string; name: string }>> {
  if (!name) return [];
  const { data } = await supabase
    .from("projects")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .limit(40);
  const needle = name.toLowerCase().trim();
  const rows = (data ?? []) as Array<{ id: string; name: string }>;
  const exact = rows.filter((p) => p.name.toLowerCase() === needle);
  if (exact.length) return exact;
  return rows.filter((p) => p.name.toLowerCase().includes(needle));
}

function splitPersonName(full: string): { first: string | null; last: string | null } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: null, last: null };
  if (parts.length === 1) return { first: parts[0], last: null };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function extractEmailFromText(text: string): string | null {
  const hit = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  return hit?.[0] ?? null;
}

function extractPhoneFromText(text: string): string | null {
  const hit = text.match(
    /\b(?:phone|mobile|cell|number)\s*(?:is|:)?\s*(\+?[\d().\-\s]{7,22})/i
  );
  const raw = hit?.[1]?.trim();
  return raw ? raw.replace(/\s+/g, " ").slice(0, 40) : null;
}

function asIsoDate(value: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysIsoDate(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function sanitizeIlikeQuery(raw: string): string {
  return raw.replace(/[%_*,()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

function stageSearchTerms(statusOrName: string): string[] {
  const s = statusOrName.trim().toLowerCase();
  if (s === "lead" || s === "new") return ["new lead", "new"];
  if (s === "active") return ["qualified", "contacted", "proposal"];
  if (s === "inactive") return ["lost"];
  if (s === "won") return ["won"];
  if (s === "lost") return ["lost"];
  return [s];
}

async function requireOneContact(
  supabase: LunaSupabaseClient,
  workspaceId: string,
  nameOrEmail: string | null
): Promise<{ id: string; label: string } | { error: string }> {
  const matches = await findContactMatches(supabase, workspaceId, nameOrEmail);
  if (!matches.length) {
    return { error: "I could not find that contact in this workspace." };
  }
  if (matches.length > 1) {
    return {
      error: `Several contacts match. Say which one: ${matches
        .slice(0, 4)
        .map((m) => m.label)
        .join(", ")}.`,
    };
  }
  return matches[0];
}

async function requireOneProject(
  supabase: LunaSupabaseClient,
  workspaceId: string,
  name: string | null,
  projectId: string | null
): Promise<{ id: string; name: string } | { error: string }> {
  if (projectId) {
    const { data } = await supabase
      .from("projects")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .eq("id", projectId)
      .maybeSingle();
    if (data?.id) return { id: data.id, name: data.name ?? "project" };
  }
  const matches = await findProjectMatches(supabase, workspaceId, name);
  if (!matches.length) {
    return { error: "I could not find that project in this workspace." };
  }
  if (matches.length > 1) {
    return {
      error: `Several projects match. Say which one: ${matches
        .slice(0, 4)
        .map((m) => m.name)
        .join(", ")}.`,
    };
  }
  return matches[0];
}

export async function getLunaWorkspaceContext(
  supabase: LunaSupabaseClient,
  workspaceId: string,
  userId: string,
  timezoneOverride?: string | null
): Promise<LunaWorkspaceContext> {
  const empty: LunaWorkspaceContext = {
    contacts: [],
    projects: [],
    tasks: [],
    openTasks: [],
    contracts: [],
    invoices: [],
    forms: [],
    workflows: [],
    homeCity: null,
    timezone: null,
    localTime: null,
  };
  const member = await assertLunaWorkspaceMember(supabase, workspaceId, userId);
  if (!member) return empty;
  const { workspace_id } = member;

  const [
    { data: contacts },
    { data: projects },
    { data: tasks },
    { data: openTasks },
    { data: contracts },
    { data: invoices },
    { data: forms },
    { data: workflows },
    { data: aiSettings },
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, type, first_name, last_name, organization_name, email, phone")
      .eq("workspace_id", workspace_id)
      .order("updated_at", { ascending: false })
      .limit(40),
    supabase
      .from("projects")
      .select("id, name, status, due_date")
      .eq("workspace_id", workspace_id)
      .order("updated_at", { ascending: false })
      .limit(40),
    supabase
      .from("tasks")
      .select("id, title, status, priority, due_date, project_id")
      .eq("workspace_id", workspace_id)
      .order("updated_at", { ascending: false })
      .limit(40),
    supabase
      .from("tasks")
      .select("id, title, status, priority, due_date")
      .eq("workspace_id", workspace_id)
      .neq("status", "done")
      .order("due_date", { ascending: true })
      .limit(20),
    supabase
      .from("contracts")
      .select("id, name, status, contract_number, end_date")
      .eq("workspace_id", workspace_id)
      .in("status", ["draft", "sent"])
      .order("updated_at", { ascending: false })
      .limit(15),
    supabase
      .from("invoices")
      .select("id, invoice_number, status, due_date")
      .eq("workspace_id", workspace_id)
      .in("status", ["sent", "overdue"])
      .order("due_date", { ascending: true })
      .limit(15),
    supabase
      .from("forms")
      .select("id, name, status")
      .eq("workspace_id", workspace_id)
      .order("updated_at", { ascending: false })
      .limit(15),
    supabase
      .from("automation_workflows")
      .select("id, name, is_active, trigger_type")
      .eq("workspace_id", workspace_id)
      .order("updated_at", { ascending: false })
      .limit(15),
    supabase
      .from("workspace_ai_settings")
      .select("home_city, timezone")
      .eq("workspace_id", workspace_id)
      .maybeSingle(),
  ]);

  const homeCity =
    typeof aiSettings?.home_city === "string" && aiSettings.home_city.trim()
      ? aiSettings.home_city.trim().slice(0, 80)
      : null;
  const timezone =
    (typeof aiSettings?.timezone === "string" &&
    isIanaTimeZone(aiSettings.timezone)
      ? aiSettings.timezone
      : null) ||
    (timezoneOverride && isIanaTimeZone(timezoneOverride)
      ? timezoneOverride
      : null);

  return {
    contacts: (contacts ?? []).map((row: Record<string, unknown>) =>
      pickKeys(row, CONTACT_CONTEXT_KEYS)
    ),
    projects: (projects ?? []).map((row: Record<string, unknown>) =>
      pickKeys(row, PROJECT_CONTEXT_KEYS)
    ),
    tasks: (tasks ?? []).map((row: Record<string, unknown>) =>
      pickKeys(row, TASK_CONTEXT_KEYS)
    ),
    openTasks: (openTasks ?? []).map((row: Record<string, unknown>) =>
      pickKeys(row, ["id", "title", "status", "priority", "due_date"])
    ),
    contracts: (contracts ?? []).map((row: Record<string, unknown>) =>
      pickKeys(row, ["id", "name", "status", "contract_number", "end_date"])
    ),
    invoices: (invoices ?? []).map((row: Record<string, unknown>) =>
      pickKeys(row, ["id", "invoice_number", "status", "due_date"])
    ),
    forms: (forms ?? []).map((row: Record<string, unknown>) =>
      pickKeys(row, ["id", "name", "status"])
    ),
    workflows: (workflows ?? []).map((row: Record<string, unknown>) =>
      pickKeys(row, ["id", "name", "is_active", "trigger_type"])
    ),
    homeCity,
    timezone,
    localTime: timezone ? formatTimeInZone(timezone) : null,
  };
}

/**
 * Compact, sanitized CRM snapshot for Gemini. Membership is required.
 * Uses real table columns (contacts have first/last name, invoices use total).
 */
export async function getWorkspaceContext(
  supabase: LunaSupabaseClient,
  workspaceId: string,
  userId: string
): Promise<WorkspaceContextPayload> {
  const member = await assertLunaWorkspaceMember(supabase, workspaceId, userId);
  if (!member) {
    throw new Error("Unauthorized: not a member of this workspace");
  }
  const { workspace_id } = member;

  const [
    { data: settings },
    { data: contacts },
    { data: tasks },
    { data: invoices },
    { data: projects },
    { data: activityLogs },
    { data: knowledgeBase },
    { data: openContracts },
  ] = await Promise.all([
    supabase
      .from("workspace_ai_settings")
      .select("home_city, timezone, custom_instructions")
      .eq("workspace_id", workspace_id)
      .maybeSingle(),
    supabase
      .from("contacts")
      .select("id, first_name, last_name, organization_name, email, type")
      .eq("workspace_id", workspace_id)
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("tasks")
      .select("id, title, status, priority, due_date")
      .eq("workspace_id", workspace_id)
      .neq("status", "done")
      .limit(20),
    supabase
      .from("invoices")
      .select("id, invoice_number, total, status, due_date")
      .eq("workspace_id", workspace_id)
      .in("status", ["sent", "overdue"])
      .limit(20),
    supabase
      .from("projects")
      .select("id, name, status")
      .eq("workspace_id", workspace_id)
      .eq("status", "active")
      .limit(20),
    supabase
      .from("activity_logs")
      .select("actor_type, action, description, created_at")
      .eq("workspace_id", workspace_id)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("knowledge_base")
      .select("id, title, category, content")
      .eq("workspace_id", workspace_id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("contracts")
      .select("id, name, value, status")
      .eq("workspace_id", workspace_id)
      .in("status", ["draft", "sent", "active"])
      .order("updated_at", { ascending: false })
      .limit(10),
  ]);

  const rawPayload: WorkspaceContextPayload = {
    workspaceId: workspace_id,
    settings: {
      home_city: settings?.home_city ?? "Not specified",
      timezone: settings?.timezone ?? "UTC",
      custom_instructions: sanitizeCustomInstructions(
        settings?.custom_instructions
      ),
    },
    contacts: (contacts ?? []).map((c: Record<string, unknown>) => {
      const name =
        [c.first_name, c.last_name].filter(Boolean).join(" ").trim() ||
        (typeof c.organization_name === "string" ? c.organization_name : "") ||
        (typeof c.email === "string" ? c.email : "Unnamed contact");
      return {
        id: String(c.id),
        name,
        email: typeof c.email === "string" ? c.email : null,
        company:
          typeof c.organization_name === "string" ? c.organization_name : null,
        status: typeof c.type === "string" ? c.type : null,
      };
    }),
    tasks: (tasks ?? []).map((t: Record<string, unknown>) => ({
      id: String(t.id),
      title: String(t.title ?? ""),
      status: String(t.status ?? "todo"),
      priority: typeof t.priority === "string" ? t.priority : null,
      due_date: typeof t.due_date === "string" ? t.due_date : null,
    })),
    invoices: (invoices ?? []).map((i: Record<string, unknown>) => ({
      id: String(i.id),
      invoice_number: String(i.invoice_number ?? ""),
      amount: Number(i.total ?? 0),
      status: String(i.status ?? ""),
      due_date: typeof i.due_date === "string" ? i.due_date : null,
    })),
    projects: (projects ?? []).map((p: Record<string, unknown>) => ({
      id: String(p.id),
      name: String(p.name ?? ""),
      status: String(p.status ?? ""),
    })),
    recentActivity: (activityLogs ?? [])
      .filter(
        (row: Record<string, unknown>) =>
          (row.actor_type === "user" || row.actor_type === "luna") &&
          typeof row.description === "string" &&
          typeof row.action === "string"
      )
      .map((row: Record<string, unknown>) => ({
        actor_type: row.actor_type as "user" | "luna",
        action: String(row.action).slice(0, 80),
        description: String(row.description).slice(0, 240),
        created_at:
          typeof row.created_at === "string" ? row.created_at : "",
      })),
    knowledgeBase: (knowledgeBase ?? [])
      .filter(
        (row: Record<string, unknown>) =>
          typeof row.title === "string" && typeof row.content === "string"
      )
      .map((row: Record<string, unknown>) => ({
        title: String(row.title).slice(0, 120),
        category:
          typeof row.category === "string" && row.category.trim()
            ? row.category.trim().slice(0, 40)
            : "general",
        content: String(row.content).slice(0, 600),
      })),
    openContracts: (openContracts ?? [])
      .filter((row: Record<string, unknown>) => typeof row.name === "string")
      .map((row: Record<string, unknown>) => ({
        name: String(row.name).slice(0, 120),
        value:
          typeof row.value === "number"
            ? row.value
            : row.value != null && Number.isFinite(Number(row.value))
              ? Number(row.value)
              : null,
        status: typeof row.status === "string" ? row.status : "draft",
      })),
    summary: {
      totalContacts: (contacts ?? []).length,
      openTasksCount: (tasks ?? []).length,
      activeProjectsCount: (projects ?? []).length,
      outstandingInvoicesCount: (invoices ?? []).length,
    },
  };

  return sanitizePayload(rawPayload);
}

export function formatLunaContextForPrompt(ctx: LunaWorkspaceContext): string {
  const line = (items: string[], empty: string) =>
    items.length ? items.join("\n") : empty;

  const contacts = ctx.contacts.map((c) => {
    const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
    const label =
      name ||
      (typeof c.organization_name === "string" ? c.organization_name : "") ||
      (typeof c.email === "string" ? c.email : "Unnamed contact");
    const email = typeof c.email === "string" ? ` ${c.email}` : "";
    return `- ${label}${email}`;
  });
  const projects = ctx.projects.map((p) => {
    const name = typeof p.name === "string" ? p.name : "Untitled project";
    const status = typeof p.status === "string" ? p.status : "unknown";
    return `- ${name} (${status})`;
  });
  const openTasks = ctx.openTasks.map((t) => {
    const title = typeof t.title === "string" ? t.title : "Untitled task";
    const status = typeof t.status === "string" ? t.status : "todo";
    const due = typeof t.due_date === "string" ? `, due ${t.due_date}` : "";
    return `- ${title} (${status}${due})`;
  });
  const contracts = ctx.contracts.map((c) => {
    const name = typeof c.name === "string" ? c.name : "Contract";
    const status = typeof c.status === "string" ? c.status : "";
    return `- ${name} (${status})`;
  });
  const invoices = ctx.invoices.map((i) => {
    const num =
      typeof i.invoice_number === "string" ? i.invoice_number : "Invoice";
    const status = typeof i.status === "string" ? i.status : "";
    const due = typeof i.due_date === "string" ? `, due ${i.due_date}` : "";
    return `- ${num} (${status}${due})`;
  });
  const forms = ctx.forms.map((f) => {
    const name = typeof f.name === "string" ? f.name : "Form";
    const status = typeof f.status === "string" ? f.status : "";
    return `- ${name} (${status})`;
  });
  const workflows = ctx.workflows.map((w) => {
    const name = typeof w.name === "string" ? w.name : "Workflow";
    const active = w.is_active === true ? "on" : "off";
    return `- ${name} (${active})`;
  });

  return [
    "Current workspace snapshot (this workspace only):",
    ctx.homeCity || ctx.timezone || ctx.localTime
      ? `Locale: ${[
          ctx.homeCity ? `home city ${ctx.homeCity}` : "",
          ctx.timezone ? `timezone ${ctx.timezone}` : "",
          ctx.localTime ? `local time ${ctx.localTime}` : "",
        ]
          .filter(Boolean)
          .join("; ")}.`
      : "",
    `Contacts:\n${line(contacts, "none")}`,
    `Projects:\n${line(projects, "none")}`,
    `Open tasks:\n${line(openTasks, "none")}`,
    `Pending contracts:\n${line(contracts, "none")}`,
    `Unpaid invoices:\n${line(invoices, "none")}`,
    `Forms:\n${line(forms, "none")}`,
    `Workflows:\n${line(workflows, "none")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const WMO: Record<number, string> = {
  0: "clear skies",
  1: "mainly clear",
  2: "partly cloudy",
  3: "overcast",
  45: "fog",
  48: "fog",
  51: "light drizzle",
  61: "rain",
  63: "rain",
  65: "heavy rain",
  71: "snow",
  80: "rain showers",
  95: "thunderstorms",
};

export async function fetchWeather(location: string): Promise<Record<string, unknown>> {
  const q = location.trim();
  if (!q) return { error: "Need a city or place name." };

  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`
  );
  if (!geoRes.ok) return { error: "Could not look up that location." };
  const geo = (await geoRes.json()) as {
    results?: { name: string; latitude: number; longitude: number; admin1?: string; country?: string }[];
  };
  const place = geo.results?.[0];
  if (!place) return { error: `I could not find weather for ${q}.` };

  const wxRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph`
  );
  if (!wxRes.ok) return { error: "Weather service is unavailable." };
  const wx = (await wxRes.json()) as {
    current?: { temperature_2m?: number; weather_code?: number; wind_speed_10m?: number };
  };
  const code = wx.current?.weather_code ?? 0;
  const label = WMO[code] ?? "current conditions";
  const where = [place.name, place.admin1, place.country].filter(Boolean).join(", ");
  const temp = wx.current?.temperature_2m;
  const wind = wx.current?.wind_speed_10m;
  return {
    ok: true,
    summary: `In ${where} it is ${temp ?? "about"} degrees Fahrenheit with ${label}${
      typeof wind === "number" ? ` and wind around ${Math.round(wind)} miles per hour` : ""
    }.`,
  };
}

export type LunaToolResult = Record<string, unknown>;

export type LunaForcedTool = {
  name: string;
  args: Record<string, unknown>;
};

const PLACEHOLDER_FORM_NAME_RE =
  /^(an?\s+)?(new\s+)?(draft\s+)?((intake|contact|lead|client|feedback|survey|sign[\s-]?up)\s+)?forms?$/i;

export function isPlaceholderFormName(value: string): boolean {
  const n = value.trim().toLowerCase().replace(/['"]/g, "");
  return !n || PLACEHOLDER_FORM_NAME_RE.test(n) || n === "untitled" || n === "default";
}

export function isFormCreateRequest(message: string): boolean {
  const m = message.trim();
  return (
    /\b(create|make|build|start|new|draft|add)\b.{0,80}\bforms?\b/i.test(m) ||
    /\bforms?\b.{0,50}\b(create|make|build|start|new|draft|add)\b/i.test(m) ||
    /\b(contact|intake|lead|sign[- ]?up|client|feedback|survey)\s+form\b/i.test(m)
  );
}

function cleanExtractedFormName(raw: string | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim();
  s = s.replace(/^[\s"'`]+/, "").replace(/[\s"'`.!?]+$/, "");
  s = s.split(/[.?!,;]/)[0]?.trim() ?? "";
  s = s.replace(/\s+(please|thanks|thank you|now|for me|real quick|quickly)[\s.!?]*$/i, "");
  s = s.replace(
    /\s+(?:with|that has|that includes|and then|and add|and include|fields?:)\b[\s\S]*$/i,
    ""
  );
  s = s.replace(/^(and|an|n)\s+/i, "");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length < 1 || s.length > 80) return null;
  if (isPlaceholderFormName(s)) return null;
  if (/^(it|this|that|the|a|an|my|your|form|forms)$/i.test(s)) return null;
  return s;
}

/** Pull an explicit form title from phrasing like "name it Shay" or "called Shay". */
export function extractFormNameFromMessage(message: string): string | null {
  const m = message.trim();
  const patterns: RegExp[] = [
    /\b(?:and|an|n)\s+name\s+it\s+(?:as\s+|to\s+)?["']?([^"'?\n]+)/i,
    /\bname\s+(?:the\s+form|this(?:\s+form)?|it|that(?:\s+form)?)\s+(?:as\s+|to\s+)?["']?([^"'?\n]+)/i,
    /\b(?:give\s+it|with|under)\s+(?:the\s+)?name\s+["']?([^"'?\n]+)/i,
    /\b(?:its|it's|it is)\s+(?:name\s+is\s+|called\s+|named\s+)?["']?([A-Za-z][^"'?\n]{0,60})/i,
    /\bname(?:'?s)?\s+is\s+["']?([^"'?\n]+)/i,
    /\b(?:call|title)\s+(?:it|this|that|the\s+form)\s+(?:as\s+)?["']?([^"'?\n]+)/i,
    /\b(?:named|called|titled|labelled|labeled)\s+(?:it\s+)?["']?([^"'?\n]+)/i,
    /\bforms?\s+(?:called|named|titled|labelled|labeled)\s+["']?([^"'?\n]+)/i,
    /\bform(?:'s)?\s+name(?:\s+is|\s+as|:)?\s+["']?([^"'?\n]+)/i,
    /\bforms?\s*[,:]\s*["']?([A-Za-z][^"'?\n]{0,60})/i,
  ];
  for (const re of patterns) {
    const name = cleanExtractedFormName(m.match(re)?.[1]);
    if (name) return name;
  }
  const quoted: string[] = [];
  const quoteRe = /["']([^"']{1,80})["']/g;
  let quoteHit: RegExpExecArray | null = quoteRe.exec(m);
  while (quoteHit) {
    const name = cleanExtractedFormName(quoteHit[1]);
    if (name) quoted.push(name);
    quoteHit = quoteRe.exec(m);
  }
  if (quoted.length === 1) return quoted[0];
  return null;
}

/**
 * Only accept a form title that the user actually said.
 * Gemini's "Intake form" default is ignored unless those words are in the message.
 */
export function resolveFormCreateName(
  message: string,
  proposed?: string | null
): string | null {
  const extracted = extractFormNameFromMessage(message);
  if (extracted) return extracted;
  const guess = (proposed ?? "").trim();
  if (!guess || isPlaceholderFormName(guess)) return null;
  const escaped = guess.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i").test(message)) {
    return guess.slice(0, 80);
  }
  return null;
}

const OTHER_INTENT_RE =
  /\b(weather|forecast|briefing|email|invoice|contract|task|contact|project|cancel|never mind|nevermind|stop)\b/i;

/** After Luna asked for a form name, treat a short reply like "Shay" as the title. */
export function interpretPendingFormName(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed) return null;
  if (OTHER_INTENT_RE.test(trimmed) && !/\bform\b/i.test(trimmed)) return null;
  const explicit = extractFormNameFromMessage(trimmed);
  if (explicit) return explicit;
  if (isFormCreateRequest(trimmed)) return extractFormNameFromMessage(trimmed);
  const words = trimmed.replace(/[?.!]/g, "").trim();
  if (words.split(/\s+/).length <= 6) return cleanExtractedFormName(words);
  return null;
}

export const ASK_FORM_NAME_REPLY =
  "What should I name that form? Once you give me a name, I'll create the draft.";

function extractNamedRecordTitle(message: string, noun: string): string | null {
  const m = message.trim();
  const patterns: RegExp[] = [
    new RegExp(
      `\\b(?:named|called|titled)\\s+(?:it\\s+)?["']?([^"'?\\n]+)`,
      "i"
    ),
    new RegExp(
      `\\bname\\s+(?:the\\s+${noun}|this(?:\\s+${noun})?|it)\\s+(?:as\\s+|to\\s+)?["']?([^"'?\\n]+)`,
      "i"
    ),
    new RegExp(
      `\\b${noun}s?\\s+(?:named|called|titled)\\s+["']?([^"'?\\n]+)`,
      "i"
    ),
    new RegExp(
      `\\b(?:add|create|make|new|save)\\s+(?:me\\s+)?(?:a\\s+|an\\s+|the\\s+)?${noun}s?\\s+(?:named\\s+|called\\s+|for\\s+|titled\\s+)?["']?([A-Za-z][^"'?\\n]{0,60})`,
      "i"
    ),
  ];
  for (const re of patterns) {
    let name = cleanExtractedFormName(m.match(re)?.[1]);
    if (name) {
      name = name
        .replace(
          /\s+(?:for|with|email|phone|due|budget|client|whose)\b[\s\S]*$/i,
          ""
        )
        .trim();
      if (name) return name;
    }
  }
  return null;
}

function stripRecordTitleTail(name: string): string {
  return name
    .replace(
      /\s+(?:for|with|email|phone|due|budget|client|whose)\b[\s\S]*$/i,
      ""
    )
    .trim();
}

export function extractContactNameFromMessage(message: string): string | null {
  const m = message.trim();
  const extra: RegExp[] = [
    /\b(?:add|create|make)\s+([A-Za-z][A-Za-z .'-]{1,40}?)\s+(?:as\s+(?:a\s+)?contact|to\s+(?:my\s+)?contacts?)\b/i,
    /\bcontact\s+(?:named|called|for|titled)\s+["']?([A-Za-z][^"'?\n]{0,40})/i,
  ];
  for (const re of extra) {
    const name = cleanExtractedFormName(m.match(re)?.[1]);
    if (name) {
      const trimmed = stripRecordTitleTail(name);
      if (trimmed) return trimmed;
    }
  }
  return extractNamedRecordTitle(m, "contact");
}

export function extractProjectNameFromMessage(message: string): string | null {
  return extractNamedRecordTitle(message, "project");
}

export const ASK_CONTACT_NAME_REPLY =
  "What should I name that contact? Once you give me a name, I'll add them.";

export const ASK_PROJECT_NAME_REPLY =
  "What should I name that project? Once you give me a name, I'll create it.";

export function fillContactCreateArgs(
  message: string,
  args: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...args };
  const full =
    extractContactNameFromMessage(message) ||
    (typeof next.name === "string" ? next.name.trim() : "") ||
    (typeof next.full_name === "string" ? next.full_name.trim() : "") ||
    [next.first_name, next.last_name].filter((v) => typeof v === "string").join(" ").trim();
  if (full && !next.first_name && !next.last_name && !next.organization_name) {
    const { first, last } = splitPersonName(full);
    next.first_name = first;
    next.last_name = last;
  }
  if (!next.organization_name && typeof next.company === "string") {
    next.organization_name = next.company;
  }
  const email = extractEmailFromText(message);
  const phone = extractPhoneFromText(message);
  if (email && !next.email) next.email = email;
  if (phone && !next.phone) next.phone = phone;
  return next;
}

export function isContactCreateRequest(message: string): boolean {
  const m = message.trim();
  if (/\bcontact\s+form\b/i.test(m)) return false;
  if (/\b(update|edit|change|rename)\b/i.test(m) && !/\b(create|add|new|make)\b/i.test(m)) {
    return false;
  }
  return (
    /\b(create|add|new|make|save)\b.{0,80}\bcontacts?\b/i.test(m) ||
    /\bcontacts?\b.{0,50}\b(create|add|new|make|save)\b/i.test(m)
  );
}

export function isProjectCreateRequest(message: string): boolean {
  const m = message.trim();
  if (/\b(update|edit|change|rename)\b/i.test(m) && !/\b(create|add|new|make)\b/i.test(m)) {
    return false;
  }
  return (
    /\b(create|add|new|make|start)\b.{0,80}\bprojects?\b/i.test(m) ||
    /\bprojects?\b.{0,50}\b(create|add|new|make|start)\b/i.test(m)
  );
}

function defaultFormFields(message: string): string {
  const fieldsHint = message.match(/\bfields?\s*[:\-]\s*(.+)$/i)?.[1];
  if (fieldsHint?.trim()) return fieldsHint.trim().slice(0, 200);
  if (/\bcontact\s+form\b/i.test(message)) return "Name, Email, Phone";
  return "Name, Email, Phone, Message";
}

/** Run weather/forms even if Gemini skips tools or errors out. */
export function inferLunaForcedTools(
  message: string,
  defaults?: { homeCity?: string | null }
): LunaForcedTool[] {
  const m = message.trim();
  const tools: LunaForcedTool[] = [];

  if (/\b(weather|forecast|temperature)\b/i.test(m)) {
    const loc = m.match(
      /\b(?:weather|forecast|temperature)\b(?:\s+\w+){0,4}?\s+(?:in|for|at)\s+([A-Za-z][A-Za-z .'-]{1,40})/i
    )?.[1];
    let location = (loc ?? "")
      .replace(/[?.!]+$/g, "")
      .replace(/\b(today|right now|currently|please)\b/gi, "")
      .trim();
    if (!location || /^(here|there|outside|home)$/i.test(location)) {
      location = (defaults?.homeCity ?? "").trim();
    }
    tools.push({
      name: "get_weather",
      args: { location: location.slice(0, 80) },
    });
  }

  if (isFormCreateRequest(m)) {
    const name = resolveFormCreateName(m);
    if (name) {
      tools.push({
        name: "create_form",
        args: { name, fields: defaultFormFields(m) },
      });
    }
  }

  if (isContactCreateRequest(m)) {
    const fullName = extractContactNameFromMessage(m);
    if (fullName) {
      const org =
        /\b(company|organization|business|org)\b/i.test(m) &&
        !/\bperson\b/i.test(m);
      const { first, last } = org
        ? { first: null, last: null }
        : splitPersonName(fullName);
      tools.push({
        name: "create_contact",
        args: {
          first_name: first,
          last_name: last,
          organization_name: org ? fullName : null,
          email: extractEmailFromText(m),
          phone: extractPhoneFromText(m),
          type: org ? "organization" : "person",
        },
      });
    }
  }

  if (isProjectCreateRequest(m)) {
    const name = extractProjectNameFromMessage(m);
    if (name) {
      const contactHint = m.match(
        /\b(?:for|with|client)\s+([A-Za-z][A-Za-z .'-]{1,40})/i
      )?.[1];
      tools.push({
        name: "create_project",
        args: {
          name,
          contact_name: contactHint
            ? cleanExtractedFormName(contactHint)
            : null,
        },
      });
    }
  }

  if (
    /\b(what'?s on (my )?(calendar|schedule|plate)|show (the |my )?calendar|this week|upcoming (tasks|deadlines|meetings|invoices))\b/i.test(
      m
    )
  ) {
    tools.push({ name: "get_calendar", args: {} });
  }

  return tools;
}

export function spokenToolResult(result: LunaToolResult): string {
  if (typeof result.summary === "string" && result.summary.trim()) {
    return result.summary.trim();
  }
  if (typeof result.error === "string" && result.error.trim()) {
    return result.error.trim();
  }
  return "";
}

/** Record a Luna tool action on `activity_logs` for this workspace only. */
export async function logLunaAction(
  supabase: LunaSupabaseClient,
  workspaceId: string,
  action: string,
  description: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  if (!workspaceId.trim() || !action.trim() || !description.trim()) return;
  try {
    await supabase.from("activity_logs").insert({
      workspace_id: workspaceId,
      actor_type: "luna",
      action: action.slice(0, 80),
      description: description.slice(0, 500),
      metadata: sanitizePayload(metadata),
    });
  } catch {
    /* table may not exist until 0018 is applied */
  }
}

async function lunaMutationOk(
  supabase: LunaSupabaseClient,
  workspaceId: string,
  action: string,
  summary: string,
  metadata: Record<string, unknown> = {}
): Promise<LunaToolResult> {
  await logLunaAction(supabase, workspaceId, action, summary, metadata);
  return { ok: true, summary };
}

/** Workspace-scoped tool runner. All writes go through here, then logLunaAction. */
export async function executeLunaTool(
  supabase: LunaSupabaseClient,
  workspaceId: string,
  userId: string,
  name: string,
  args: Record<string, unknown>
): Promise<LunaToolResult> {
  const member = await assertLunaWorkspaceMember(supabase, workspaceId, userId);
  if (!member) {
    return { error: "Not a member of this workspace." };
  }
  const { workspace_id, user_id } = member;

  try {
    if (name === "get_weather") {
      return await fetchWeather(argString(args, "location") ?? "");
    }

    if (name === "get_daily_briefing") {
      const ctx = await getLunaWorkspaceContext(supabase, workspace_id, user_id);
      return {
        ok: true,
        open_task_count: ctx.openTasks.length,
        open_tasks: ctx.openTasks.slice(0, 8).map((t) => ({
          title: t.title,
          status: t.status,
          due_date: t.due_date,
          priority: t.priority,
        })),
        pending_contracts: ctx.contracts.slice(0, 5).map((c) => ({
          name: c.name,
          status: c.status,
        })),
        unpaid_invoices: ctx.invoices.slice(0, 5).map((i) => ({
          invoice_number: i.invoice_number,
          status: i.status,
          due_date: i.due_date,
        })),
        active_projects: ctx.projects
          .filter((p) => p.status === "active" || p.status === "planning")
          .slice(0, 6)
          .map((p) => ({ name: p.name, status: p.status })),
      };
    }

    if (name === "get_calendar") {
      const from = todayIsoDate();
      const to = plusDaysIsoDate(14);
      const [tasksRes, invoicesRes, projectsRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("title, status, due_date")
          .eq("workspace_id", workspace_id)
          .not("due_date", "is", null)
          .gte("due_date", from)
          .lte("due_date", to)
          .order("due_date", { ascending: true })
          .limit(20),
        supabase
          .from("invoices")
          .select("invoice_number, status, due_date")
          .eq("workspace_id", workspace_id)
          .not("due_date", "is", null)
          .gte("due_date", from)
          .lte("due_date", to)
          .order("due_date", { ascending: true })
          .limit(20),
        supabase
          .from("projects")
          .select("name, status, due_date")
          .eq("workspace_id", workspace_id)
          .not("due_date", "is", null)
          .gte("due_date", from)
          .lte("due_date", to)
          .order("due_date", { ascending: true })
          .limit(20),
      ]);
      const lines: string[] = [];
      for (const row of tasksRes.data ?? []) {
        const due = ymdFromUnknown(row.due_date);
        if (!due) continue;
        const title = typeof row.title === "string" ? row.title : "Task";
        lines.push(`Task ${title} on ${due}`);
      }
      for (const row of invoicesRes.data ?? []) {
        const due = ymdFromUnknown(row.due_date);
        if (!due) continue;
        const num =
          typeof row.invoice_number === "string" ? row.invoice_number : "invoice";
        lines.push(`Invoice ${num} due ${due}`);
      }
      for (const row of projectsRes.data ?? []) {
        const due = ymdFromUnknown(row.due_date);
        if (!due) continue;
        const pname = typeof row.name === "string" ? row.name : "Project";
        lines.push(`Project ${pname} due ${due}`);
      }
      if (lines.length === 0) {
        return {
          ok: true,
          summary:
            "Nothing dated on the workspace calendar in the next two weeks.",
        };
      }
      return {
        ok: true,
        summary: `On the calendar through ${to}: ${lines.slice(0, 12).join(". ")}.`,
      };
    }

    if (name === "create_contact") {
      const filled = fillContactCreateArgs("", args);
      // Prefer fields already on args; fillContactCreateArgs with "" still maps name/full_name.
      const firstName =
        argString(filled, "first_name") || argString(args, "first_name");
      const lastName =
        argString(filled, "last_name") || argString(args, "last_name");
      const organizationName =
        argString(filled, "organization_name") ||
        argString(args, "organization_name") ||
        argString(args, "company");
      const email = argString(filled, "email") || argString(args, "email");
      const full =
        argString(args, "name") || argString(args, "full_name") || "";
      let first = firstName;
      let last = lastName;
      if (!first && !last && !organizationName && full) {
        const split = splitPersonName(full);
        first = split.first;
        last = split.last;
      }
      if (!first && !last && !organizationName && !email) {
        return { error: "Need a name, organization, or email to create a contact." };
      }
      const typeArg = argString(args, "type");
      const type =
        typeArg === "organization" || typeArg === "lead" || typeArg === "person"
          ? typeArg
          : organizationName && !first && !last
            ? "organization"
            : "person";

      const { data, error } = await supabase
        .from("contacts")
        .insert({
          workspace_id,
          type,
          first_name: first,
          last_name: last,
          organization_name: organizationName,
          email,
          phone: argString(args, "phone"),
          address: argString(args, "address"),
          notes: argString(args, "notes"),
          tags: [],
        })
        .select("id, first_name, last_name, organization_name, email")
        .maybeSingle();

      if (error || !data) {
        return { error: error?.message ?? "Could not create contact." };
      }
      const label = contactSpokenLabel(data as Record<string, unknown>);
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Created contact ${label}.`
      );
    }

    if (name === "update_contact") {
      const lookup =
        argString(args, "contact_name") ||
        argString(args, "current_name") ||
        argString(args, "email") ||
        argString(args, "lookup");
      const found = await requireOneContact(supabase, workspace_id, lookup);
      if ("error" in found) return found;

      const updates: Record<string, unknown> = {};
      const fullName = argString(args, "full_name") || argString(args, "new_name");
      if (fullName) {
        const { first, last } = splitPersonName(fullName);
        if (first) updates.first_name = first;
        updates.last_name = last;
      }
      const firstName = argString(args, "first_name");
      const lastName = argString(args, "last_name");
      const organizationName =
        argString(args, "organization_name") || argString(args, "company");
      const email = argString(args, "email");
      const phone = argString(args, "phone");
      const address = argString(args, "address");
      const notes = argString(args, "notes");
      const typeArg = argString(args, "type");
      if (firstName) updates.first_name = firstName;
      if (lastName) updates.last_name = lastName;
      if (organizationName) updates.organization_name = organizationName;
      if (email) updates.email = email;
      if (phone) updates.phone = phone;
      if (address) updates.address = address;
      if (notes) updates.notes = notes;
      if (typeArg === "organization" || typeArg === "lead" || typeArg === "person") {
        updates.type = typeArg;
      }
      const tagsRaw = argString(args, "tags");
      if (tagsRaw) {
        updates.tags = tagsRaw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 12);
      }
      if (!Object.keys(updates).length) {
        return { error: "Tell me what to change on that contact." };
      }

      const { data, error } = await supabase
        .from("contacts")
        .update(updates)
        .eq("id", found.id)
        .eq("workspace_id", workspace_id)
        .select("id, first_name, last_name, organization_name, email, phone")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not update that contact." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Updated contact ${contactSpokenLabel(data as Record<string, unknown>)}.`
      );
    }

    if (name === "update_project_status") {
      let status = argString(args, "status");
      if (status === "archived") status = "cancelled";
      if (!status || !PROJECT_STATUSES.has(status)) {
        return {
          error:
            "Status must be planning, active, on_hold, completed, or cancelled.",
        };
      }

      let projectId = argStringAny(args, ["project_id", "projectId"]);
      const projectName = argStringAny(args, ["project_name", "name"]);
      if (!projectId) projectId = await findProjectId(supabase, workspace_id, projectName);
      if (!projectId) {
        return { error: "Need a project id or name in this workspace." };
      }

      const { data, error } = await supabase
        .from("projects")
        .update({ status })
        .eq("id", projectId)
        .eq("workspace_id", workspace_id)
        .select("id, name, status")
        .maybeSingle();

      if (error || !data) {
        return { error: error?.message ?? "Project not found in this workspace." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Updated ${data.name ?? "project"} to ${data.status}.`
      );
    }

    if (name === "create_project") {
      const projectName = argString(args, "name");
      if (!projectName) return { error: "A project name is required." };
      const statusArg = argString(args, "status");
      const status =
        statusArg && PROJECT_STATUSES.has(statusArg) ? statusArg : "planning";
      const contactId = await findContactId(
        supabase,
        workspace_id,
        argString(args, "contact_name") ?? argString(args, "contact_email")
      );
      const budget = argNumber(args, "budget");
      const { data, error } = await supabase
        .from("projects")
        .insert({
          workspace_id,
          name: projectName,
          description: argString(args, "description"),
          status,
          contact_id: contactId,
          start_date: asIsoDate(argString(args, "start_date")),
          due_date: asIsoDate(argString(args, "due_date")),
          budget,
          currency: argString(args, "currency") || "USD",
        })
        .select("id, name, status")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not create project." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Created project ${data.name} as ${data.status}.`
      );
    }

    if (name === "update_project") {
      const found = await requireOneProject(
        supabase,
        workspace_id,
        argString(args, "project_name") || argString(args, "current_name"),
        argString(args, "project_id")
      );
      if ("error" in found) return found;

      const updates: Record<string, unknown> = {};
      const newName = argString(args, "name") || argString(args, "new_name");
      if (newName) updates.name = newName;
      const description = argString(args, "description");
      if (description) updates.description = description;
      const statusArg = argString(args, "status");
      if (statusArg) {
        if (!PROJECT_STATUSES.has(statusArg)) {
          return {
            error:
              "Status must be planning, active, on_hold, completed, or cancelled.",
          };
        }
        updates.status = statusArg;
      }
      const contactRef =
        argString(args, "contact_name") || argString(args, "contact_email");
      if (contactRef) {
        const contactId = await findContactId(supabase, workspace_id, contactRef);
        if (!contactId) {
          return { error: "I could not find that contact to attach to the project." };
        }
        updates.contact_id = contactId;
      }
      const startDate = asIsoDate(argString(args, "start_date"));
      const dueDate = asIsoDate(argString(args, "due_date"));
      if (startDate) updates.start_date = startDate;
      if (dueDate) updates.due_date = dueDate;
      const budget = argNumber(args, "budget");
      if (budget !== null) updates.budget = budget;
      const currency = argString(args, "currency");
      if (currency) updates.currency = currency;

      if (!Object.keys(updates).length) {
        return { error: "Tell me what to change on that project." };
      }

      const { data, error } = await supabase
        .from("projects")
        .update(updates)
        .eq("id", found.id)
        .eq("workspace_id", workspace_id)
        .select("id, name, status")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not update that project." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Updated project ${data.name}. It is ${data.status}.`
      );
    }

    if (name === "create_task" || name === "schedule_event") {
      const title =
        argString(args, "title") ||
        argString(args, "summary") ||
        argString(args, "name");
      if (!title) return { error: "A task title is required." };

      const statusArg = argString(args, "status");
      const status =
        statusArg === "pending"
          ? "todo"
          : statusArg && TASK_STATUSES.has(statusArg)
            ? statusArg
            : "todo";
      const priorityArg = argString(args, "priority");
      const priority =
        priorityArg === "normal"
          ? "medium"
          : priorityArg && TASK_PRIORITIES.has(priorityArg)
            ? priorityArg
            : "medium";

      let projectId = argStringAny(args, ["project_id", "projectId"]);
      if (!projectId) {
        projectId = await findProjectId(
          supabase,
          workspace_id,
          argString(args, "project_name")
        );
      }
      if (projectId) {
        const { data: project } = await supabase
          .from("projects")
          .select("id")
          .eq("id", projectId)
          .eq("workspace_id", workspace_id)
          .maybeSingle();
        if (!project) {
          return { error: "That project is not in this workspace." };
        }
      }

      const dueDate = asIsoDate(
        argStringAny(args, ["due_date", "dueDate"]) ??
          argString(args, "due_date")
      );
      const reminderArg = parseReminderMinutes(
        args.reminder_minutes_before ?? args.reminderMinutesBefore
      );
      if (!reminderArg.ok) return { error: reminderArg.error };
      if (reminderArg.value && !dueDate) {
        return { error: "A due date is required to set a reminder." };
      }

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          workspace_id,
          project_id: projectId,
          title,
          description: argString(args, "description"),
          status,
          priority,
          assignee_id: user_id,
          due_date: dueDate,
          reminder_minutes_before: reminderArg.value,
          position: 0,
          completed_at: status === "done" ? new Date().toISOString() : null,
        })
        .select("id, title, status, due_date")
        .maybeSingle();

      if (error || !data) {
        return { error: error?.message ?? "Could not create task." };
      }
      const dueBit =
        typeof data.due_date === "string" ? ` due ${data.due_date}` : "";
      return lunaMutationOk(
        supabase,
        workspace_id,
        "create_task",
        `Created task ${data.title}${dueBit}. It is on the workspace calendar.`
      );
    }

    if (name === "create_form") {
      const formName = argString(args, "name");
      if (!formName || isPlaceholderFormName(formName)) {
        return {
          error:
            "Do not create the form yet. Ask the user what to name it. Never guess a title like Intake form.",
        };
      }
      const labels = (argString(args, "fields") ?? "Name, Email")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 12);
      const fields = labels.map((label, i) => {
        const lower = label.toLowerCase();
        const type =
          lower.includes("email")
            ? "email"
            : lower.includes("phone")
              ? "phone"
              : lower.length > 24
                ? "textarea"
                : "text";
        return {
          id: `f${i + 1}`,
          type,
          label,
          required: i < 2,
        };
      });
      const { data, error } = await supabase
        .from("forms")
        .insert({
          workspace_id,
          name: formName,
          description: argString(args, "description"),
          status: "draft",
          fields,
          submit_button_text: "Submit",
          success_message: "Thank you for your submission!",
          allow_multiple_submissions: true,
        })
        .select("id, name")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not create form." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Created draft form ${data.name}.`
      );
    }

    if (name === "create_contract" || name === "generate_contract") {
      const contractName = argStringAny(args, ["name", "title"]);
      if (!contractName) return { error: "A contract name or title is required." };
      const contactId = await resolveWorkspaceContactId(
        supabase,
        workspace_id,
        args
      );
      const projectId = await findProjectId(
        supabase,
        workspace_id,
        argString(args, "project_name")
      );
      const value = argNumber(args, "value") ?? 0;
      const number = `LUNA-${Date.now().toString(36).toUpperCase()}`;
      const { data, error } = await supabase
        .from("contracts")
        .insert({
          workspace_id,
          contact_id: contactId,
          project_id: projectId,
          contract_number: number,
          name: contractName,
          description: argString(args, "description"),
          status: "draft",
          start_date: argString(args, "start_date"),
          end_date: argString(args, "end_date"),
          value,
          currency: argString(args, "currency") ?? "USD",
          terms: argString(args, "terms"),
        })
        .select("id, name, contract_number")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not create contract." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        name === "generate_contract"
          ? `Generated contract "${data.name}" valued at $${Number(value).toFixed(2)}`
          : `Created draft contract ${data.name} (${data.contract_number}).`
      );
    }

    if (name === "send_email") {
      let to = argStringAny(args, ["to", "to_email", "contact_email"]);
      let contactId: string | null = null;
      if (to && !looksLikeEmail(to)) {
        contactId = await findContactId(supabase, workspace_id, to);
        to = null;
        if (contactId) {
          const { data: namedContact } = await supabase
            .from("contacts")
            .select("id, email")
            .eq("id", contactId)
            .eq("workspace_id", workspace_id)
            .maybeSingle();
          to = typeof namedContact?.email === "string" ? namedContact.email : null;
        }
      }
      const contactRef =
        argString(args, "contact_name") ?? argString(args, "contact_email");
      if (!to && contactRef) {
        contactId = await findContactId(supabase, workspace_id, contactRef);
        if (contactId) {
          const { data: contact } = await supabase
            .from("contacts")
            .select("id, email")
            .eq("id", contactId)
            .eq("workspace_id", workspace_id)
            .maybeSingle();
          to = typeof contact?.email === "string" ? contact.email : null;
        }
      }
      const subject = argString(args, "subject");
      const body = argString(args, "body");
      if (!to || !subject || !body) {
        return { error: "Need a recipient email or contact, plus subject and body." };
      }
      if (!looksLikeEmail(to)) {
        return { error: "That contact has no email on file in this workspace." };
      }
      const safeBody = body
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const result = await sendServerEmail({
        workspaceId: workspace_id,
        to,
        toName: argString(args, "to_name"),
        subject: subject.slice(0, 500),
        html: `<p>${safeBody.replace(/\n/g, "<br/>")}</p>`,
        contactId,
      });
      if (!result.success) {
        return { error: result.error ?? "Email failed to send." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Sent email to ${to.slice(0, 120)} about ${subject.slice(0, 80)}.`
      );
    }

    if (name === "create_invoice") {
      const amount =
        argNumber(args, "amount") ?? argNumber(args, "total");
      if (amount === null || amount <= 0) {
        return { error: "Need a billing amount greater than zero." };
      }
      const contactRef =
        argString(args, "contact_name") ||
        argString(args, "contact_email") ||
        argString(args, "contact_id");
      const found = await requireOneContact(supabase, workspace_id, contactRef);
      if ("error" in found) {
        return {
          error:
            found.error === "I could not find that contact in this workspace."
              ? "Need an existing contact to bill. Name the client or their email."
              : found.error,
        };
      }
      const invoiceNumber =
        argStringAny(args, ["invoice_number", "invoiceNumber"]) ||
        `INV-${Date.now().toString(36).toUpperCase()}`;
      const dueDate =
        asIsoDate(argStringAny(args, ["due_date", "dueDate"])) ||
        plusDaysIsoDate(14);
      const issueDate = todayIsoDate();
      const currency = argString(args, "currency") || "USD";
      const lineItems = [
        {
          description: "Services",
          quantity: 1,
          unit_price: amount,
          amount,
        },
      ];
      const { data, error } = await supabase
        .from("invoices")
        .insert({
          workspace_id,
          contact_id: found.id,
          invoice_number: invoiceNumber.slice(0, 40),
          status: "draft",
          issue_date: issueDate,
          due_date: dueDate,
          line_items: lineItems,
          subtotal: amount,
          tax_rate: 0,
          tax_amount: 0,
          total: amount,
          currency,
          notes: argString(args, "notes"),
        })
        .select("id, invoice_number, total, due_date")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not create invoice." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Generated draft invoice #${data.invoice_number} for $${Number(data.total).toFixed(2)}`
      );
    }

    if (name === "send_email_draft") {
      let to =
        argStringAny(args, ["recipient_email", "recipientEmail", "to_email"]) ||
        null;
      const contactRef =
        argString(args, "contact_name") ?? argString(args, "contact_email");
      if (!to && contactRef) {
        const found = await requireOneContact(supabase, workspace_id, contactRef);
        if ("error" in found) return found;
        const { data: contact } = await supabase
          .from("contacts")
          .select("email")
          .eq("id", found.id)
          .eq("workspace_id", workspace_id)
          .maybeSingle();
        to = typeof contact?.email === "string" ? contact.email : null;
      }
      const subject = argString(args, "subject");
      const bodyText =
        argStringAny(args, ["body_text", "bodyText", "body"]) ?? "";
      if (!to || !looksLikeEmail(to) || !subject || !bodyText) {
        return {
          error:
            "Need a recipient email or contact with an email, plus subject and body.",
        };
      }
      const { data, error } = await supabase
        .from("email_drafts")
        .insert({
          workspace_id,
          recipient_email: to,
          subject: subject.slice(0, 500),
          body_text: bodyText.slice(0, 20000),
          status: "draft",
        })
        .select("id, recipient_email, subject")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not save that email draft." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Drafted email to ${data.recipient_email}: "${data.subject}"`
      );
    }

    if (name === "search_knowledge_base") {
      const q = sanitizeIlikeQuery(argString(args, "query") ?? "");
      if (!q) return { error: "Need a search term." };
      const pattern = `%${q}%`;
      const { data, error } = await supabase
        .from("knowledge_base")
        .select("title, category, content")
        .eq("workspace_id", workspace_id)
        .or(`title.ilike.${pattern},content.ilike.${pattern}`)
        .limit(3);
      if (error) {
        return { error: error.message ?? "Could not search the knowledge base." };
      }
      const results = (data ?? []).map((row: Record<string, unknown>) => ({
        title: String(row.title ?? ""),
        category: typeof row.category === "string" ? row.category : "general",
        excerpt: String(row.content ?? "").slice(0, 280),
      }));
      if (!results.length) {
        return {
          ok: true,
          summary: "No relevant documents found.",
          results: [],
        };
      }
      const searchResults = results
        .map((r: { title: string; excerpt: string }) => `${r.title}: ${r.excerpt}`)
        .join(" | ");
      return {
        ok: true,
        summary: `Based on your knowledge base: ${searchResults}`.slice(0, 900),
        results,
      };
    }

    if (name === "move_lead_stage") {
      const stageHint = argStringAny(args, ["stage_name", "newStatus", "status"]);
      const stage = await findPipelineStage(supabase, workspace_id, stageHint);
      if (!stage) {
        return {
          error:
            "Need a pipeline stage such as New Lead, Contacted, Qualified, Proposal Sent, Won, or Lost.",
        };
      }
      let leadId = argString(args, "lead_id");
      let fromStageId: string | null = null;
      let leadTitle = "lead";
      let contactIdForLead: string | null = null;
      if (!leadId) {
        const contactId = await resolveWorkspaceContactId(
          supabase,
          workspace_id,
          args
        );
        if (!contactId) {
          return { error: "Need a contact that is already on the pipeline." };
        }
        const { data: lead } = await supabase
          .from("leads")
          .select("id, stage_id, title, contact_id")
          .eq("workspace_id", workspace_id)
          .eq("contact_id", contactId)
          .limit(1)
          .maybeSingle();
        if (!lead?.id) {
          return { error: "That contact does not have a pipeline lead yet." };
        }
        leadId = String(lead.id);
        fromStageId = typeof lead.stage_id === "string" ? lead.stage_id : null;
        leadTitle = typeof lead.title === "string" ? lead.title : "lead";
        contactIdForLead =
          typeof lead.contact_id === "string" ? lead.contact_id : contactId;
      } else {
        const { data: lead } = await supabase
          .from("leads")
          .select("id, stage_id, title, contact_id")
          .eq("id", leadId)
          .eq("workspace_id", workspace_id)
          .maybeSingle();
        if (!lead?.id) {
          return { error: "Lead not found in this workspace." };
        }
        fromStageId = typeof lead.stage_id === "string" ? lead.stage_id : null;
        leadTitle = typeof lead.title === "string" ? lead.title : "lead";
        contactIdForLead =
          typeof lead.contact_id === "string" ? lead.contact_id : null;
      }
      const { data, error } = await supabase
        .from("leads")
        .update({ stage_id: stage.id })
        .eq("id", leadId)
        .eq("workspace_id", workspace_id)
        .select("id, title, stage_id")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not move that lead." };
      }
      void executeWorkflowsForTrigger(
        "lead_stage_change",
        {
          lead_id: data.id,
          lead: data,
          from_stage_id: fromStageId,
          to_stage_id: stage.id,
          contact_id: contactIdForLead,
          user_id,
        },
        workspace_id
      ).catch(() => undefined);
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Moved pipeline lead ${leadTitle} to ${stage.name}.`
      );
    }

    if (name === "create_workflow") {
      const wfName = argString(args, "name");
      const trigger = argString(args, "trigger_type") ?? "contact_created";
      if (!wfName) return { error: "A workflow name is required." };
      if (!WORKFLOW_TRIGGERS.has(trigger)) {
        return {
          error:
            "Trigger must be form_submission, lead_stage_change, contact_created, task_completed, invoice_sent, or contract_signed.",
        };
      }
      const taskTitle = argString(args, "task_title") ?? "Follow up";
      const { data, error } = await supabase
        .from("automation_workflows")
        .insert({
          workspace_id,
          name: wfName,
          description: argString(args, "description"),
          is_active: false,
          trigger_type: trigger,
          trigger_config: {},
          actions: [{ type: "create_task", config: { title: taskTitle } }],
        })
        .select("id, name")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not create workflow." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Created workflow ${data.name} as inactive. Turn it on when you are ready.`
      );
    }

    if (name === "toggle_workflow") {
      const wfName = argString(args, "name");
      const on =
        args.is_active === true ||
        argString(args, "is_active") === "true" ||
        argString(args, "state") === "on";
      if (!wfName) return { error: "Need the workflow name." };
      const { data: found } = await supabase
        .from("automation_workflows")
        .select("id, name")
        .eq("workspace_id", workspace_id)
        .ilike("name", wfName)
        .limit(1)
        .maybeSingle();
      if (!found?.id) return { error: "Workflow not found in this workspace." };
      const { data, error } = await supabase
        .from("automation_workflows")
        .update({ is_active: on })
        .eq("id", found.id)
        .eq("workspace_id", workspace_id)
        .select("name, is_active")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not update workflow." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `${data.name} is now ${data.is_active ? "on" : "off"}.`
      );
    }

    return { error: "Unknown tool." };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Tool failed.",
    };
  }
}
