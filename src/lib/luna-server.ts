import "server-only";

import {
  sanitizeLunaContext,
  sanitizePayload,
  sanitizeCustomInstructions,
  formatTimeInZone,
  isIanaTimeZone,
  type WorkspaceContextPayload,
} from "@/lib/luna";
import {
  industryDisplayLabel,
  industrySectorLabel,
} from "@/lib/industryVerticals";
import { sendServerEmail } from "@/lib/email/sendServerEmail";
import { createOrReuseInvoicePaymentLink } from "@/lib/billing/invoicePaymentLink";
import { sendEsignEmail } from "@/lib/esign/sendEmail";
import { generateSignToken, getAppBaseUrl } from "@/lib/esign/helpers";
import { sendSigningReminder } from "@/lib/esign/reminders";
import { executeWorkflowsForTrigger } from "@/lib/automation/executeWorkflow";
import { ymdFromUnknown } from "@/lib/calendar";
import { parseReminderMinutes } from "@/lib/tasks/reminder";
import { createAdminClient } from "@/lib/supabase/server";
import { PERMIT_STATUSES, PERMIT_KINDS, SERVICE_PLAN_FREQUENCIES, CLAIM_STATUSES, CLAIM_PRICING_MODES, MATERIAL_ORDER_STATUSES, MATERIAL_TYPES, PAINT_SHEENS, PREP_KINDS, PREP_STATUSES, HOA_COLOR_STATUSES, TREATMENT_METHODS, ACCESS_ENTRY_METHODS, FINDING_SYSTEMS, FINDING_SEVERITIES, FINDING_STATUSES, REPORT_STATUSES, ADDON_KINDS, ADDON_STATUSES, ASSET_CATEGORIES, ASSET_LOCATIONS, ASSET_STATUSES, RESERVATION_STATUSES, RATE_TYPES, PICKUP_METHODS, MAINT_STATUSES, CHANGE_ORDER_STATUSES, SUB_TRADES, PHASE_KINDS, PHASE_STATUSES, DELAY_CAUSES, DRAW_KINDS, DRAW_STATUSES, LIEN_WAIVER_STATUSES, SHOP_DESIGN_STATUSES, SHOP_SELECTION_KINDS, SHOP_STAGES, SHOP_FAB_STEPS, STEEL_DRAWING_STATUSES, STEEL_PE_STATUSES, STEEL_METALS, STEEL_FINISHES, STEEL_STAGES, STEEL_FAB_STEPS, WELD_TYPES, WELD_RESULTS, NDT_RESULTS } from "@/lib/fieldService";
import {
  BAR_COMPLIANCE_KINDS,
  BAR_COMPLIANCE_STATUSES,
  BAR_CONSULT_KINDS,
  BAR_CREW_ROLES,
  BAR_EVENT_STATUSES,
  BAR_EVENT_TYPES,
  BAR_INCIDENT_KINDS,
  BAR_ONSITE_KINDS,
  BAR_ORDER_KINDS,
  BAR_ORDER_STATUSES,
  BAR_PACKAGE_TIERS,
  BAR_SETUP_STYLES,
  barEventDateFields,
  flattenBarEventSpecs,
} from "@/lib/barService";
import { executeBarLunaTool } from "@/lib/verticals/bar/luna";
import { executePlannerLunaTool } from "@/lib/verticals/planner/luna";
import { executeVenueLunaTool } from "@/lib/verticals/venue/luna";
import { executeBridalLunaTool } from "@/lib/verticals/bridal/luna";
import { executeCateringLunaTool } from "@/lib/verticals/catering/luna";
import { executeChefLunaTool } from "@/lib/verticals/chef/luna";
import { executePhotoLunaTool } from "@/lib/verticals/photo/luna";
import { executeHubScheduleSmsTool } from "@/lib/hubScheduleSms/luna";
import { executeSuperAdminLunaTool } from "@/lib/luna-super-admin";

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
const FORM_STATUSES = new Set(["draft", "active", "archived"]);
const CONTRACT_STATUSES = new Set([
  "draft",
  "sent",
  "active",
  "completed",
  "cancelled",
]);
const INVOICE_STATUSES = new Set([
  "draft",
  "sent",
  "paid",
  "overdue",
  "cancelled",
]);
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
  "contact_id",
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
  workspaceName: string | null;
  industry: string | null;
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

function argBool(args: Record<string, unknown>, key: string): boolean | null {
  const value = args[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value !== 0;
  if (typeof value === "string" && value.trim()) {
    const s = value.trim().toLowerCase();
    if (["true", "yes", "1", "paid"].includes(s)) return true;
    if (["false", "no", "0"].includes(s)) return false;
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
  return matches.length === 1 ? matches[0].id : null;
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
      .is("archived_at", null)
      .maybeSingle();
    return typeof data?.id === "string" ? data.id : null;
  }
  return findContactId(
    supabase,
    workspaceId,
    argString(args, "contact_name") ?? argString(args, "contact_email")
  );
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = cur;
    }
  }
  return row[b.length];
}

const NAME_ALIAS_GROUPS: string[][] = [
  ["jon", "john", "johnny", "jonathan", "jonny"],
  ["mike", "michael", "mick", "mikey"],
  ["bob", "robert", "rob", "bobby"],
  ["bill", "william", "will", "billy", "liam"],
  ["liz", "elizabeth", "beth", "eliza"],
  ["kate", "katie", "katherine", "catherine", "cathy"],
  ["tom", "thomas", "tommy"],
  ["jim", "james", "jimmy", "jamie"],
  ["dave", "david"],
  ["chris", "christopher", "kristopher"],
  ["matt", "matthew"],
  ["dan", "daniel", "danny"],
  ["steve", "steven", "stephen"],
  ["jen", "jennifer", "jenny"],
  ["alex", "alexander", "alexandra", "lex"],
  ["nick", "nicholas", "nico"],
  ["joe", "joseph", "joey"],
  ["sam", "samuel", "samantha"],
  ["ben", "benjamin", "benny"],
  ["nate", "nathan", "nathaniel"],
  ["rick", "richard", "dick", "rich"],
  ["meg", "megan", "meghan"],
  ["becky", "rebecca", "becca"],
];

const NAME_ALIAS_MAP: Map<string, Set<string>> = (() => {
  const map = new Map<string, Set<string>>();
  for (const group of NAME_ALIAS_GROUPS) {
    const set = new Set(group);
    for (const name of group) map.set(name, set);
  }
  return map;
})();

function normalizePersonName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9@.\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSimilarity(needle: string, hay: string): number {
  if (!needle || !hay) return 0;
  if (needle === hay) return 1;
  const aliases = NAME_ALIAS_MAP.get(needle);
  if (aliases?.has(hay)) return 0.93;
  if (hay.startsWith(needle) && needle.length >= 3) return 0.88;
  if (needle.startsWith(hay) && hay.length >= 3) return 0.84;
  const dist = levenshtein(needle, hay);
  const maxLen = Math.max(needle.length, hay.length);
  if (maxLen >= 3 && dist <= 1) return 0.9;
  if (maxLen >= 5 && dist <= 2) return 0.8;
  if (hay.includes(needle) && needle.length >= 3) return 0.72;
  return 0;
}

function phraseSimilarity(needle: string, haystack: string): number {
  const n = normalizePersonName(needle);
  const h = normalizePersonName(haystack);
  if (!n || !h) return 0;
  if (n === h) return 1;
  const nToks = n.split(" ");
  const hToks = h.split(" ");
  let sum = 0;
  for (const nt of nToks) {
    let best = 0;
    for (const ht of hToks) best = Math.max(best, tokenSimilarity(nt, ht));
    sum += best;
  }
  return sum / nToks.length;
}

function rankFuzzyMatches<T extends { id: string; label: string }>(
  needle: string,
  rows: T[],
  extraHay?: (row: T) => string[]
): T[] {
  const scored = rows
    .map((row) => {
      const fields = [row.label, ...(extraHay ? extraHay(row) : [])];
      const score = Math.max(
        ...fields.map((field) => phraseSimilarity(needle, field))
      );
      return { row, score };
    })
    .filter((item) => item.score >= 0.72)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return [];
  const top = scored[0].score;
  const close = scored.filter((item) => top - item.score <= 0.12);
  if (
    close.length > 1 &&
    !(scored.length >= 2 && scored[0].score - scored[1].score >= 0.12)
  ) {
    return close.slice(0, 5).map((item) => item.row);
  }
  return [scored[0].row];
}

function askWhichMatch(kind: string, labels: string[]): string {
  return `A few ${kind} are close to that. Which one did you mean: ${labels
    .slice(0, 5)
    .join(", ")}?`;
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
      .is("archived_at", null)
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
    .is("archived_at", null)
    .limit(80);
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const mapped = rows.map((row) => ({
    id: String(row.id),
    label: contactSpokenLabel(row),
    first: typeof row.first_name === "string" ? row.first_name : "",
    last: typeof row.last_name === "string" ? row.last_name : "",
    org: typeof row.organization_name === "string" ? row.organization_name : "",
    email: typeof row.email === "string" ? row.email : "",
  }));
  return rankFuzzyMatches(nameOrEmail, mapped, (row) => [
    row.first,
    row.last,
    [row.first, row.last].filter(Boolean).join(" "),
    row.org,
    row.email.split("@")[0] ?? "",
  ]);
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
  const rows = (data ?? []) as Array<{ id: string; name: string }>;
  return rankFuzzyMatches(
    name,
    rows.map((p) => ({ id: p.id, label: p.name })),
    (row) => [row.label]
  ).map((row) => ({ id: row.id, name: row.label }));
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
      error: askWhichMatch(
        "contacts",
        matches.map((m) => m.label)
      ),
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
      error: askWhichMatch(
        "projects",
        matches.map((m) => m.name)
      ),
    };
  }
  return matches[0];
}

function labelsToFormFields(raw: string) {
  const labels = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
  return labels.map((label, i) => {
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
}

async function findTitleMatches(
  supabase: LunaSupabaseClient,
  workspaceId: string,
  table: string,
  nameColumn: string,
  needle: string | null
): Promise<Array<{ id: string; label: string }>> {
  if (!needle) return [];
  const q = sanitizeIlikeQuery(needle);
  if (!q) return [];
  const { data } = await supabase
    .from(table)
    .select(`id, ${nameColumn}`)
    .eq("workspace_id", workspaceId)
    .limit(40);
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const mapped = rows
    .map((row) => ({
      id: String(row.id),
      label: String(row[nameColumn] ?? ""),
    }))
    .filter((row) => row.label);
  return rankFuzzyMatches(q, mapped);
}

function pickUniqueOrAsk(
  matches: Array<{ id: string; label: string }>,
  empty: string
): { id: string; label: string } | { error: string } {
  if (!matches.length) return { error: empty };
  if (matches.length > 1) {
    return {
      error: askWhichMatch(
        "matches",
        matches.map((m) => m.label)
      ),
    };
  }
  return matches[0];
}

async function requireOneTask(
  supabase: LunaSupabaseClient,
  workspaceId: string,
  title: string | null
): Promise<{ id: string; label: string } | { error: string }> {
  return pickUniqueOrAsk(
    await findTitleMatches(supabase, workspaceId, "tasks", "title", title),
    "I could not find that task in this workspace."
  );
}

async function requireOneForm(
  supabase: LunaSupabaseClient,
  workspaceId: string,
  name: string | null
): Promise<{ id: string; label: string } | { error: string }> {
  return pickUniqueOrAsk(
    await findTitleMatches(supabase, workspaceId, "forms", "name", name),
    "I could not find that form in this workspace."
  );
}

async function requireOneWorkflow(
  supabase: LunaSupabaseClient,
  workspaceId: string,
  name: string | null
): Promise<{ id: string; label: string } | { error: string }> {
  return pickUniqueOrAsk(
    await findTitleMatches(
      supabase,
      workspaceId,
      "automation_workflows",
      "name",
      name
    ),
    "I could not find that workflow in this workspace."
  );
}

async function requireOneEsignDoc(
  supabase: LunaSupabaseClient,
  workspaceId: string,
  name: string | null
): Promise<{ id: string; label: string } | { error: string }> {
  return pickUniqueOrAsk(
    await findTitleMatches(
      supabase,
      workspaceId,
      "esign_documents",
      "name",
      name
    ),
    "I could not find that e-sign document in this workspace."
  );
}

async function requireOneLead(
  supabase: LunaSupabaseClient,
  workspaceId: string,
  title: string | null
): Promise<{ id: string; label: string } | { error: string }> {
  return pickUniqueOrAsk(
    await findTitleMatches(supabase, workspaceId, "leads", "title", title),
    "I could not find that lead in this workspace."
  );
}

async function requireOneKnowledge(
  supabase: LunaSupabaseClient,
  workspaceId: string,
  title: string | null
): Promise<{ id: string; label: string } | { error: string }> {
  return pickUniqueOrAsk(
    await findTitleMatches(
      supabase,
      workspaceId,
      "knowledge_base",
      "title",
      title
    ),
    "I could not find that knowledge article in this workspace."
  );
}

async function requireOneEmailTemplate(
  supabase: LunaSupabaseClient,
  workspaceId: string,
  name: string | null
): Promise<{ id: string; label: string } | { error: string }> {
  return pickUniqueOrAsk(
    await findTitleMatches(
      supabase,
      workspaceId,
      "email_templates",
      "name",
      name
    ),
    "I could not find that email template in this workspace."
  );
}

async function requireOneContract(
  supabase: LunaSupabaseClient,
  workspaceId: string,
  name: string | null
): Promise<{ id: string; label: string } | { error: string }> {
  if (!name) {
    return { error: "Need the contract name or number." };
  }
  const byName = await findTitleMatches(
    supabase,
    workspaceId,
    "contracts",
    "name",
    name
  );
  if (byName.length) return pickUniqueOrAsk(byName, "");
  const byNumber = await findTitleMatches(
    supabase,
    workspaceId,
    "contracts",
    "contract_number",
    name
  );
  return pickUniqueOrAsk(
    byNumber,
    "I could not find that contract in this workspace."
  );
}

async function requireOneInvoice(
  supabase: LunaSupabaseClient,
  workspaceId: string,
  invoiceNumber: string | null,
  contactRef: string | null
): Promise<
  | {
      id: string;
      invoice_number: string;
      total: number;
      status: string;
      contact_id: string;
    }
  | { error: string }
> {
  const numberQ = invoiceNumber ? sanitizeIlikeQuery(invoiceNumber) : "";
  if (numberQ) {
    const matches = await findTitleMatches(
      supabase,
      workspaceId,
      "invoices",
      "invoice_number",
      numberQ
    );
    const picked = pickUniqueOrAsk(
      matches,
      "I could not find that invoice in this workspace."
    );
    if ("error" in picked) return picked;
    const { data } = await supabase
      .from("invoices")
      .select("id, invoice_number, total, status, contact_id")
      .eq("id", picked.id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!data?.id) {
      return { error: "I could not find that invoice in this workspace." };
    }
    return {
      id: data.id,
      invoice_number: String(data.invoice_number),
      total: Number(data.total) || 0,
      status: String(data.status),
      contact_id: String(data.contact_id),
    };
  }
  if (contactRef) {
    const contact = await requireOneContact(supabase, workspaceId, contactRef);
    if ("error" in contact) return contact;
    const { data } = await supabase
      .from("invoices")
      .select("id, invoice_number, total, status, contact_id")
      .eq("workspace_id", workspaceId)
      .eq("contact_id", contact.id)
      .order("updated_at", { ascending: false })
      .limit(8);
    const rows = (data ?? []) as Array<{
      id: string;
      invoice_number: string;
      total: number;
      status: string;
      contact_id: string;
    }>;
    if (!rows.length) {
      return { error: `No invoices for ${contact.label} in this workspace.` };
    }
    if (rows.length > 1) {
      return {
        error: `Several invoices for ${contact.label}. Say the number: ${rows
          .slice(0, 5)
          .map((r) => r.invoice_number)
          .join(", ")}.`,
      };
    }
    return rows[0];
  }
  return { error: "Need an invoice number or the client name." };
}

function icsDateValue(ymd: string): string {
  return ymd.replace(/-/g, "");
}

function nextIcsDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10).replace(/-/g, "");
}

function buildMeetingIcs(title: string, ymd: string, description: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const summary = title.replace(/[\r\n]+/g, " ").slice(0, 120);
  const desc = description.replace(/[\r\n]+/g, " ").slice(0, 400);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lunenix//Luna//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:luna-${Date.now()}@lunenix`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${icsDateValue(ymd)}`,
    `DTEND;VALUE=DATE:${nextIcsDate(ymd)}`,
    `SUMMARY:${summary}`,
    desc ? `DESCRIPTION:${desc}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
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
    workspaceName: null,
    industry: null,
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
    { data: workspaceRow },
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, type, first_name, last_name, organization_name, email, phone")
      .eq("workspace_id", workspace_id)
      .is("archived_at", null)
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
      .select("id, title, status, priority, due_date, project_id, contact_id")
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
    supabase
      .from("workspaces")
      .select("name, industry_preset, industry_custom_label")
      .eq("id", workspace_id)
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

  const workspaceName =
    typeof workspaceRow?.name === "string" && workspaceRow.name.trim()
      ? workspaceRow.name.trim().slice(0, 120)
      : null;
  const industryLabel = industryDisplayLabel(
    typeof workspaceRow?.industry_preset === "string"
      ? workspaceRow.industry_preset
      : null,
    typeof workspaceRow?.industry_custom_label === "string"
      ? workspaceRow.industry_custom_label
      : null
  );
  const sector = industrySectorLabel(
    typeof workspaceRow?.industry_preset === "string"
      ? workspaceRow.industry_preset
      : null
  );
  const industryLine =
    industryLabel && industryLabel !== "—"
      ? sector
        ? `${industryLabel} — ${sector}`
        : industryLabel
      : null;

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
    workspaceName,
    industry: industryLine,
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
      .is("archived_at", null)
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
    ctx.workspaceName ? `Company: ${ctx.workspaceName}.` : "",
    ctx.industry ? `Industry: ${ctx.industry}.` : "",
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

export function isContactNoteRequest(message: string): boolean {
  const m = message.trim();
  if (/\b(create|make|new)\s+(a\s+|an\s+)?contacts?\b/i.test(m)) return false;
  return (
    /\b(add|append|put|write|leave|save)\b.{0,80}\bnotes?\b/i.test(m) ||
    /\bnotes?\s+(?:to|on|for)\b/i.test(m)
  );
}

export function extractContactFromNoteRequest(message: string): string | null {
  const m = message.trim();
  const patterns: RegExp[] = [
    /\bnotes?\s+to\s+(?:the\s+)?(?:contact\s+)?([A-Za-z][A-Za-z .'-]{1,50}?)(?:\s*[:.\-]|\s+that\b|\s+saying\b|$)/i,
    /\bcontact\s+([A-Za-z][A-Za-z .'-]{1,50}?)\s*$/i,
    /\bfor\s+(?:contact\s+)?([A-Za-z][A-Za-z .'-]{1,50}?)(?:\s*[:.\-]|\s+that\b|$)/i,
  ];
  for (const re of patterns) {
    const name = cleanExtractedFormName(m.match(re)?.[1]);
    if (name) return stripRecordTitleTail(name);
  }
  return extractContactNameFromMessage(m);
}

export function extractNoteBody(message: string): string | null {
  const m = message.trim();
  const colon = m.match(/\bnotes?\b[\s\S]{0,100}[:]\s*(.+)$/i);
  if (colon?.[1]?.trim()) return colon[1].trim().slice(0, 2000);
  const toColon = m.match(
    /\bto\s+(?:the\s+)?(?:contact\s+)?[A-Za-z][A-Za-z .'-]{1,50}\s*[:\-]\s*(.+)$/i
  );
  if (toColon?.[1]?.trim()) return toColon[1].trim().slice(0, 2000);
  const saying = m.match(/\b(?:saying|that says?)\s+["']?(.+?)["']?\s*$/i);
  if (saying?.[1]?.trim() && saying[1].trim().length > 2) {
    return saying[1].trim().slice(0, 2000);
  }
  const thatClause = m.match(
    /\bnotes?\s+to\s+(?:the\s+)?(?:contact\s+)?[A-Za-z][A-Za-z .'-]{1,50}?\s+that\s+(.+)$/i
  );
  if (thatClause?.[1]?.trim()) return thatClause[1].trim().slice(0, 2000);
  return null;
}

export const ASK_CONTACT_NOTE_REPLY =
  "What should I add to that contact's notes?";

export function isContactCreateRequest(message: string): boolean {
  const m = message.trim();
  if (/\bcontact\s+form\b/i.test(m)) return false;
  if (isContactNoteRequest(m)) return false;
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

  if (isContactNoteRequest(m)) {
    const contactName = extractContactFromNoteRequest(m);
    const notes = extractNoteBody(m);
    if (contactName && notes) {
      tools.push({
        name: "update_contact",
        args: {
          contact_name: contactName,
          notes,
          append_notes: true,
        },
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

async function lunaDeleteWorkspaceRow(
  supabase: LunaSupabaseClient,
  workspaceId: string,
  table: string,
  found: { id: string; label: string } | { error: string },
  action: string,
  noun: string
): Promise<LunaToolResult> {
  if ("error" in found) return found;
  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", found.id)
    .eq("workspace_id", workspaceId);
  if (error) {
    return { error: error.message ?? `Could not delete that ${noun}.` };
  }
  return lunaMutationOk(
    supabase,
    workspaceId,
    action,
    `Deleted ${noun} ${found.label}.`
  );
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
    const adminPack = await executeSuperAdminLunaTool(
      supabase,
      workspace_id,
      user_id,
      name,
      args,
      executeLunaTool
    );
    if (adminPack) return adminPack;

    const hubPack = await executeHubScheduleSmsTool(
      supabase,
      workspace_id,
      name,
      args
    );
    if (hubPack) {
      if ("ok" in hubPack && hubPack.ok) {
        return lunaMutationOk(
          supabase,
          workspace_id,
          name,
          hubPack.summary
        );
      }
      return hubPack;
    }

    const photoPack = await executePhotoLunaTool(
      supabase,
      workspace_id,
      name,
      args
    );
    if (photoPack) {
      if ("ok" in photoPack && photoPack.ok) {
        return lunaMutationOk(
          supabase,
          workspace_id,
          name,
          photoPack.summary
        );
      }
      return photoPack;
    }

    const chefPack = await executeChefLunaTool(
      supabase,
      workspace_id,
      name,
      args
    );
    if (chefPack) {
      if ("ok" in chefPack && chefPack.ok) {
        return lunaMutationOk(
          supabase,
          workspace_id,
          name,
          chefPack.summary
        );
      }
      return chefPack;
    }

    const cateringPack = await executeCateringLunaTool(
      supabase,
      workspace_id,
      name,
      args
    );
    if (cateringPack) {
      if ("ok" in cateringPack && cateringPack.ok) {
        return lunaMutationOk(
          supabase,
          workspace_id,
          name,
          cateringPack.summary
        );
      }
      return cateringPack;
    }

    const bridalPack = await executeBridalLunaTool(
      supabase,
      workspace_id,
      name,
      args
    );
    if (bridalPack) {
      if ("ok" in bridalPack && bridalPack.ok) {
        return lunaMutationOk(
          supabase,
          workspace_id,
          name,
          bridalPack.summary
        );
      }
      return bridalPack;
    }

    const venuePack = await executeVenueLunaTool(
      supabase,
      workspace_id,
      name,
      args
    );
    if (venuePack) {
      if ("ok" in venuePack && venuePack.ok) {
        return lunaMutationOk(
          supabase,
          workspace_id,
          name,
          venuePack.summary
        );
      }
      return venuePack;
    }

    const plannerPack = await executePlannerLunaTool(
      supabase,
      workspace_id,
      name,
      args
    );
    if (plannerPack) {
      if ("ok" in plannerPack && plannerPack.ok) {
        return lunaMutationOk(
          supabase,
          workspace_id,
          name,
          plannerPack.summary
        );
      }
      return plannerPack;
    }

    const barPack = await executeBarLunaTool(
      supabase,
      workspace_id,
      name,
      args
    );
    if (barPack) {
      if ("ok" in barPack && barPack.ok) {
        return lunaMutationOk(
          supabase,
          workspace_id,
          name,
          barPack.summary
        );
      }
      return barPack;
    }

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
      const [tasksRes, invoicesRes, projectsRes, bookingsRes] = await Promise.all([
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
        supabase
          .from("schedule_events")
          .select("title, status, starts_at")
          .eq("workspace_id", workspace_id)
          .gte("starts_at", from)
          .lte("starts_at", `${to}T23:59:59`)
          .order("starts_at", { ascending: true })
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
      for (const row of bookingsRes.data ?? []) {
        const due = ymdFromUnknown(row.starts_at);
        if (!due) continue;
        const title = typeof row.title === "string" ? row.title : "Booking";
        lines.push(`Booking ${title} on ${due}`);
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
      if (notes) {
        const append =
          args.append_notes === true ||
          argString(args, "append_notes") === "true";
        if (append) {
          const { data: existing } = await supabase
            .from("contacts")
            .select("notes")
            .eq("id", found.id)
            .eq("workspace_id", workspace_id)
            .maybeSingle();
          const prev =
            typeof existing?.notes === "string" ? existing.notes.trim() : "";
          updates.notes = prev ? `${prev}\n${notes}` : notes;
        } else {
          updates.notes = notes;
        }
      }
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
      const contactRef =
        argString(args, "contact_name") ?? argString(args, "contact_email");
      let contactId: string | null = null;
      if (contactRef) {
        const foundContact = await requireOneContact(
          supabase,
          workspace_id,
          contactRef
        );
        if ("error" in foundContact) return foundContact;
        contactId = foundContact.id;
      }
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
        const foundContact = await requireOneContact(
          supabase,
          workspace_id,
          contactRef
        );
        if ("error" in foundContact) return foundContact;
        updates.contact_id = foundContact.id;
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

    if (name === "create_task") {
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

      let contactId: string | null = null;
      const contactHint =
        argString(args, "contact_name") ?? argString(args, "contact_email");
      if (contactHint) {
        const found = await requireOneContact(
          supabase,
          workspace_id,
          contactHint
        );
        if ("error" in found) return found;
        contactId = found.id;
      }

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          workspace_id,
          project_id: projectId,
          contact_id: contactId,
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
      const fields = labelsToFormFields(
        argString(args, "fields") ?? "Name, Email"
      );
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
        const found = await requireOneContact(supabase, workspace_id, to);
        if ("error" in found) return found;
        contactId = found.id;
        to = null;
        const { data: namedContact } = await supabase
          .from("contacts")
          .select("id, email")
          .eq("id", contactId)
          .eq("workspace_id", workspace_id)
          .maybeSingle();
        to = typeof namedContact?.email === "string" ? namedContact.email : null;
      }
      const contactRef =
        argString(args, "contact_name") ?? argString(args, "contact_email");
      if (!to && contactRef) {
        const found = await requireOneContact(supabase, workspace_id, contactRef);
        if ("error" in found) return found;
        contactId = found.id;
        const { data: contact } = await supabase
          .from("contacts")
          .select("id, email")
          .eq("id", contactId)
          .eq("workspace_id", workspace_id)
          .maybeSingle();
        to = typeof contact?.email === "string" ? contact.email : null;
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
          .is("archived_at", null)
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

    if (name === "update_task") {
      const found = await requireOneTask(
        supabase,
        workspace_id,
        argStringAny(args, ["title", "task_title", "lookup"])
      );
      if ("error" in found) return found;
      const updates: Record<string, unknown> = {};
      const newTitle = argStringAny(args, ["new_title", "name"]);
      if (newTitle) updates.title = newTitle;
      if (argString(args, "description") !== null) {
        updates.description = argString(args, "description");
      }
      const statusArg = argString(args, "status");
      const status =
        statusArg === "pending"
          ? "todo"
          : statusArg && TASK_STATUSES.has(statusArg)
            ? statusArg
            : null;
      if (status) {
        updates.status = status;
        updates.completed_at =
          status === "done" ? new Date().toISOString() : null;
      }
      const priorityArg = argString(args, "priority");
      const priority =
        priorityArg === "normal"
          ? "medium"
          : priorityArg && TASK_PRIORITIES.has(priorityArg)
            ? priorityArg
            : null;
      if (priority) updates.priority = priority;
      const dueDate = asIsoDate(argStringAny(args, ["due_date", "dueDate"]));
      if (dueDate) updates.due_date = dueDate;
      const reminderArg = parseReminderMinutes(
        args.reminder_minutes_before ?? args.reminderMinutesBefore
      );
      if (!reminderArg.ok) return { error: reminderArg.error };
      if (reminderArg.value !== null) {
        updates.reminder_minutes_before = reminderArg.value;
        updates.reminder_sent_at = null;
      }
      let projectId = argStringAny(args, ["project_id", "projectId"]);
      if (!projectId && argString(args, "project_name")) {
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
        updates.project_id = projectId;
      }
      const contactHint =
        argString(args, "contact_name") ?? argString(args, "contact_email");
      if (contactHint) {
        const found = await requireOneContact(
          supabase,
          workspace_id,
          contactHint
        );
        if ("error" in found) return found;
        updates.contact_id = found.id;
      }
      if (!Object.keys(updates).length) {
        return { error: "Say what to change on that task." };
      }
      const { data, error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", found.id)
        .eq("workspace_id", workspace_id)
        .select("title, status, due_date")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not update that task." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Updated task ${data.title}. It is ${data.status}.`
      );
    }

    if (name === "complete_task") {
      const found = await requireOneTask(
        supabase,
        workspace_id,
        argStringAny(args, ["title", "task_title", "lookup"])
      );
      if ("error" in found) return found;
      const { data, error } = await supabase
        .from("tasks")
        .update({
          status: "done",
          completed_at: new Date().toISOString(),
        })
        .eq("id", found.id)
        .eq("workspace_id", workspace_id)
        .select("title")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not complete that task." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Marked ${data.title} complete.`
      );
    }

    if (name === "delete_task") {
      const found = await requireOneTask(
        supabase,
        workspace_id,
        argStringAny(args, ["title", "task_title", "lookup"])
      );
      if ("error" in found) return found;
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", found.id)
        .eq("workspace_id", workspace_id);
      if (error) {
        return { error: error.message ?? "Could not delete that task." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Deleted task ${found.label}.`
      );
    }

    if (name === "update_invoice") {
      const found = await requireOneInvoice(
        supabase,
        workspace_id,
        argStringAny(args, ["invoice_number", "lookup"]),
        argString(args, "contact_name")
      );
      if ("error" in found) return found;
      const updates: Record<string, unknown> = {};
      if (argString(args, "notes") !== null) {
        updates.notes = argString(args, "notes");
      }
      const dueDate = asIsoDate(argStringAny(args, ["due_date", "dueDate"]));
      if (dueDate) updates.due_date = dueDate;
      const amount = argNumber(args, "amount") ?? argNumber(args, "total");
      if (amount !== null) {
        if (amount <= 0) return { error: "Need a billing amount greater than zero." };
        updates.total = amount;
        updates.subtotal = amount;
        updates.line_items = [
          {
            description: "Services",
            quantity: 1,
            unit_price: amount,
            amount,
          },
        ];
      }
      const currency = argString(args, "currency");
      if (currency) updates.currency = currency;
      let status = argString(args, "status");
      if (status === "void") status = "cancelled";
      if (status) {
        if (!INVOICE_STATUSES.has(status)) {
          return {
            error:
              "Invoice status must be draft, sent, paid, overdue, or cancelled.",
          };
        }
        updates.status = status;
        if (status === "paid") updates.paid_at = new Date().toISOString();
      }
      if (!Object.keys(updates).length) {
        return { error: "Say what to change on that invoice." };
      }
      const { data, error } = await supabase
        .from("invoices")
        .update(updates)
        .eq("id", found.id)
        .eq("workspace_id", workspace_id)
        .select("invoice_number, status, total")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not update that invoice." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Updated invoice ${data.invoice_number}. It is ${data.status}.`
      );
    }

    if (name === "send_invoice") {
      const found = await requireOneInvoice(
        supabase,
        workspace_id,
        argStringAny(args, ["invoice_number", "lookup"]),
        argString(args, "contact_name")
      );
      if ("error" in found) return found;
      const { data: contact } = await supabase
        .from("contacts")
        .select("id, email, first_name, last_name, organization_name")
        .eq("id", found.contact_id)
        .eq("workspace_id", workspace_id)
        .maybeSingle();
      const to = typeof contact?.email === "string" ? contact.email : null;
      if (!to || !looksLikeEmail(to)) {
        return {
          error:
            "That invoice's contact has no email on file. Add an email, then ask me to send it.",
        };
      }
      const label = contactSpokenLabel(contact ?? {});
      const total = Number(found.total).toFixed(2);
      const result = await sendServerEmail({
        workspaceId: workspace_id,
        to,
        toName: label,
        contactId: found.contact_id,
        subject: `Invoice ${found.invoice_number}`,
        html: `<p>Please find invoice ${found.invoice_number} for $${total}.</p>`,
      });
      if (!result.success) {
        return { error: result.error ?? "Could not email that invoice." };
      }
      const { error: statusError } = await supabase
        .from("invoices")
        .update({ status: "sent" })
        .eq("id", found.id)
        .eq("workspace_id", workspace_id);
      if (statusError) {
        return { error: statusError.message };
      }
      executeWorkflowsForTrigger(
        "invoice_sent",
        {
          invoice_id: found.id,
          contact_id: found.contact_id,
          user_id,
        },
        workspace_id
      ).catch(() => undefined);
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Sent invoice ${found.invoice_number} to ${label}.`
      );
    }

    if (name === "void_invoice") {
      const found = await requireOneInvoice(
        supabase,
        workspace_id,
        argStringAny(args, ["invoice_number", "lookup"]),
        argString(args, "contact_name")
      );
      if ("error" in found) return found;
      const { data, error } = await supabase
        .from("invoices")
        .update({ status: "cancelled" })
        .eq("id", found.id)
        .eq("workspace_id", workspace_id)
        .select("invoice_number")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not void that invoice." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Voided invoice ${data.invoice_number}.`
      );
    }

    if (name === "record_invoice_payment") {
      const found = await requireOneInvoice(
        supabase,
        workspace_id,
        argStringAny(args, ["invoice_number", "lookup"]),
        argString(args, "contact_name")
      );
      if ("error" in found) return found;
      const { data, error } = await supabase
        .from("invoices")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
        })
        .eq("id", found.id)
        .eq("workspace_id", workspace_id)
        .select("invoice_number, total")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not record that payment." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Recorded payment for invoice ${data.invoice_number}, $${Number(data.total).toFixed(2)}. No card was charged.`
      );
    }

    if (name === "generate_payment_link") {
      const found = await requireOneInvoice(
        supabase,
        workspace_id,
        argStringAny(args, ["invoice_number", "lookup"]),
        argString(args, "contact_name")
      );
      if ("error" in found) return found;
      const { data: row } = await supabase
        .from("invoices")
        .select(
          "id, invoice_number, total, status, currency, stripe_payment_url, stripe_payment_link_id"
        )
        .eq("id", found.id)
        .eq("workspace_id", workspace_id)
        .maybeSingle();
      if (!row?.id) {
        return { error: "I could not load that invoice." };
      }
      const link = await createOrReuseInvoicePaymentLink(
        supabase,
        workspace_id,
        {
          id: String(row.id),
          invoice_number: String(row.invoice_number),
          total: Number(row.total) || 0,
          status: String(row.status),
          currency:
            typeof row.currency === "string" ? row.currency : "usd",
          stripe_payment_url:
            typeof row.stripe_payment_url === "string"
              ? row.stripe_payment_url
              : null,
          stripe_payment_link_id:
            typeof row.stripe_payment_link_id === "string"
              ? row.stripe_payment_link_id
              : null,
        }
      );
      if ("error" in link) return link;
      const verb = link.reused ? "Here is the existing" : "Created a";
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `${verb} payment link for invoice ${found.invoice_number}: ${link.url}`
      );
    }

    if (name === "update_form") {
      const found = await requireOneForm(
        supabase,
        workspace_id,
        argStringAny(args, ["form_name", "name", "lookup"])
      );
      if ("error" in found) return found;
      const updates: Record<string, unknown> = {};
      const newName = argString(args, "new_name");
      if (newName) updates.name = newName;
      if (argString(args, "description") !== null) {
        updates.description = argString(args, "description");
      }
      const status = argString(args, "status");
      if (status) {
        if (!FORM_STATUSES.has(status)) {
          return { error: "Form status must be draft, active, or archived." };
        }
        updates.status = status;
      }
      const fieldLabels = argString(args, "fields");
      if (fieldLabels) updates.fields = labelsToFormFields(fieldLabels);
      if (!Object.keys(updates).length) {
        return { error: "Say what to change on that form." };
      }
      const { data, error } = await supabase
        .from("forms")
        .update(updates)
        .eq("id", found.id)
        .eq("workspace_id", workspace_id)
        .select("name, status")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not update that form." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Updated form ${data.name}. It is ${data.status}.`
      );
    }

    if (name === "update_contract") {
      const found = await requireOneContract(
        supabase,
        workspace_id,
        argStringAny(args, ["contract_name", "name", "lookup"])
      );
      if ("error" in found) return found;
      const updates: Record<string, unknown> = {};
      const newName = argString(args, "new_name");
      if (newName) updates.name = newName;
      if (argString(args, "description") !== null) {
        updates.description = argString(args, "description");
      }
      if (argString(args, "terms") !== null) {
        updates.terms = argString(args, "terms");
      }
      const value = argNumber(args, "value");
      if (value !== null) updates.value = value;
      const currency = argString(args, "currency");
      if (currency) updates.currency = currency;
      const status = argString(args, "status");
      if (status) {
        if (!CONTRACT_STATUSES.has(status)) {
          return {
            error:
              "Contract status must be draft, sent, active, completed, or cancelled.",
          };
        }
        updates.status = status;
      }
      const start = asIsoDate(argString(args, "start_date"));
      const end = asIsoDate(argString(args, "end_date"));
      if (start) updates.start_date = start;
      if (end) updates.end_date = end;
      const contactRef = argString(args, "contact_name");
      if (contactRef) {
        const contact = await requireOneContact(
          supabase,
          workspace_id,
          contactRef
        );
        if ("error" in contact) return contact;
        updates.contact_id = contact.id;
      }
      if (!Object.keys(updates).length) {
        return { error: "Say what to change on that contract." };
      }
      const { data, error } = await supabase
        .from("contracts")
        .update(updates)
        .eq("id", found.id)
        .eq("workspace_id", workspace_id)
        .select("name, status")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not update that contract." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Updated contract ${data.name}. It is ${data.status}.`
      );
    }

    if (name === "send_esign") {
      const docName = argStringAny(args, ["document_name", "name"]);
      if (!docName) return { error: "Need the e-sign document name." };
      const matches = await findTitleMatches(
        supabase,
        workspace_id,
        "esign_documents",
        "name",
        docName
      );
      const picked = pickUniqueOrAsk(
        matches,
        "I could not find that e-sign document in this workspace."
      );
      if ("error" in picked) return picked;
      const { data: doc } = await supabase
        .from("esign_documents")
        .select(
          "id, name, original_file_path, sign_token, signer_name, signer_email, contact_id"
        )
        .eq("id", picked.id)
        .eq("workspace_id", workspace_id)
        .maybeSingle();
      if (!doc?.id) {
        return { error: "I could not find that e-sign document in this workspace." };
      }
      if (!doc.original_file_path) {
        return {
          error:
            "That document has no PDF yet. Upload the file in e-sign, then ask me to send it.",
        };
      }
      const { count } = await supabase
        .from("esign_fields")
        .select("id", { count: "exact", head: true })
        .eq("document_id", doc.id);
      if (!count) {
        return {
          error:
            "Add at least one signature field in e-sign before I can send it.",
        };
      }
      const signerEmail =
        argString(args, "signer_email") ||
        (typeof doc.signer_email === "string" ? doc.signer_email : null);
      if (!signerEmail || !looksLikeEmail(signerEmail)) {
        return { error: "Need a signer email on the document or in your request." };
      }
      const signerName =
        argString(args, "signer_name") ||
        (typeof doc.signer_name === "string" ? doc.signer_name : null);
      const token =
        (typeof doc.sign_token === "string" && doc.sign_token) ||
        generateSignToken();
      const admin = createAdminClient();
      const { error: updateError } = await admin
        .from("esign_documents")
        .update({
          status: "sent",
          sign_token: token,
          signer_name: signerName,
          signer_email: signerEmail,
          sent_at: new Date().toISOString(),
        })
        .eq("id", doc.id)
        .eq("workspace_id", workspace_id);
      if (updateError) {
        return { error: "Could not mark that document as sent." };
      }
      await admin.from("esign_events").insert({
        document_id: doc.id,
        event_type: "sent",
        metadata: { to: signerEmail, by: "luna" },
      });
      const signUrl = `${getAppBaseUrl()}/sign/${token}`;
      const html = `<p>${signerName ? `Hi ${signerName},` : "Hello,"}</p><p>Please review and sign <strong>${String(doc.name)}</strong>.</p><p><a href="${signUrl}">Review and sign</a></p>`;
      const emailResult = await sendEsignEmail({
        workspaceId: workspace_id,
        to: signerEmail,
        toName: signerName,
        contactId: typeof doc.contact_id === "string" ? doc.contact_id : null,
        subject: `Please sign: ${String(doc.name)}`,
        html,
      });
      if (!emailResult.success) {
        return {
          error: emailResult.error ?? "Could not email the signing link.",
        };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Sent the signing email for ${String(doc.name)}.`
      );
    }

    if (name === "search_contacts") {
      const query = sanitizeIlikeQuery(argString(args, "query") ?? "");
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, organization_name, email, type")
        .eq("workspace_id", workspace_id)
        .is("archived_at", null)
        .order("updated_at", { ascending: false })
        .limit(80);
      if (error) return { error: error.message };
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      const mapped = rows.map((row) => ({
        id: String(row.id),
        label: contactSpokenLabel(row),
        first: typeof row.first_name === "string" ? row.first_name : "",
        last: typeof row.last_name === "string" ? row.last_name : "",
        org:
          typeof row.organization_name === "string"
            ? row.organization_name
            : "",
        email: typeof row.email === "string" ? row.email : "",
        row,
      }));
      const filtered = query
        ? rankFuzzyMatches(query, mapped, (item) => [
            item.first,
            item.last,
            [item.first, item.last].filter(Boolean).join(" "),
            item.org,
            item.email.split("@")[0] ?? "",
          ])
        : mapped.slice(0, 12);
      if (!filtered.length) {
        return { ok: true, summary: "No contacts matched in this workspace." };
      }
      if (query && filtered.length > 1) {
        return {
          ok: true,
          summary: askWhichMatch(
            "contacts",
            filtered.map((item) => item.label)
          ),
        };
      }
      const spoken = filtered.map((item) => item.label).join(", ");
      return { ok: true, summary: `Contacts: ${spoken}.` };
    }

    if (name === "list_emails") {
      const query = sanitizeIlikeQuery(argString(args, "query") ?? "");
      let q = supabase
        .from("email_logs")
        .select("recipient_email, subject, status, sent_at")
        .eq("workspace_id", workspace_id)
        .order("sent_at", { ascending: false })
        .limit(8);
      if (query) {
        q = q.or(
          `subject.ilike.%${query}%,recipient_email.ilike.%${query}%`
        );
      }
      const { data, error } = await q;
      if (error) return { error: error.message };
      const rows = (data ?? []) as Array<{
        recipient_email: string;
        subject: string;
        status: string;
      }>;
      if (!rows.length) {
        return { ok: true, summary: "No outbound emails in this workspace yet." };
      }
      const spoken = rows
        .map((r) => `${r.subject} to ${r.recipient_email}, ${r.status}`)
        .join(". ");
      return { ok: true, summary: `Recent sent mail: ${spoken}.` };
    }

    if (name === "list_inbox") {
      const query = sanitizeIlikeQuery(argString(args, "query") ?? "");
      let q = supabase
        .from("inbound_emails")
        .select("from_email, from_name, subject, received_at")
        .eq("workspace_id", workspace_id)
        .order("received_at", { ascending: false })
        .limit(8);
      if (query) {
        q = q.or(
          `subject.ilike.%${query}%,from_email.ilike.%${query}%,from_name.ilike.%${query}%`
        );
      }
      const { data, error } = await q;
      if (error) return { error: error.message };
      const rows = (data ?? []) as Array<{
        from_email: string;
        from_name: string | null;
        subject: string | null;
      }>;
      if (!rows.length) {
        return { ok: true, summary: "The inbox is empty in this workspace." };
      }
      const spoken = rows
        .map(
          (r) =>
            `${r.subject || "no subject"} from ${r.from_name || r.from_email}`
        )
        .join(". ");
      return { ok: true, summary: `Inbox: ${spoken}.` };
    }

    if (name === "list_templates") {
      const { data, error } = await supabase
        .from("email_templates")
        .select("name, subject")
        .eq("workspace_id", workspace_id)
        .order("updated_at", { ascending: false })
        .limit(12);
      if (error) return { error: error.message };
      const rows = (data ?? []) as Array<{ name: string; subject: string }>;
      if (!rows.length) {
        return { ok: true, summary: "No email templates in this workspace yet." };
      }
      const spoken = rows.map((r) => r.name).join(", ");
      return { ok: true, summary: `Templates: ${spoken}.` };
    }

    if (name === "send_calendar_invite") {
      const title = argString(args, "title");
      const dueDate = asIsoDate(argStringAny(args, ["due_date", "dueDate"]));
      if (!title || !dueDate) {
        return { error: "Need a meeting title and a date as year-month-day." };
      }
      let to = argStringAny(args, ["to", "contact_email"]);
      let contactId: string | null = null;
      const contactRef =
        argString(args, "contact_name") ??
        (to && !looksLikeEmail(to) ? to : null);
      if (contactRef && (!to || !looksLikeEmail(to))) {
        const found = await requireOneContact(supabase, workspace_id, contactRef);
        if ("error" in found) return found;
        contactId = found.id;
        const { data: contact } = await supabase
          .from("contacts")
          .select("email")
          .eq("id", found.id)
          .eq("workspace_id", workspace_id)
          .maybeSingle();
        to = typeof contact?.email === "string" ? contact.email : null;
      }
      if (!to || !looksLikeEmail(to)) {
        return {
          error:
            "Need a contact with an email, or an email address, to send the calendar file.",
        };
      }
      const description = argString(args, "description") ?? "";
      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .insert({
          workspace_id,
          title,
          description: description || `Meeting on ${dueDate}`,
          status: "todo",
          priority: "medium",
          assignee_id: user_id,
          due_date: dueDate,
          contact_id: contactId,
          position: 0,
        })
        .select("title, due_date")
        .maybeSingle();
      if (taskError || !task) {
        return { error: taskError?.message ?? "Could not create the meeting task." };
      }
      const ics = buildMeetingIcs(title, dueDate, description);
      const result = await sendServerEmail({
        workspaceId: workspace_id,
        to,
        contactId,
        subject: `Invite: ${title}`,
        html: `<p>You are invited to ${title} on ${dueDate}. A calendar file is attached. This is a Lunenix task date, not a Google Calendar event.</p>`,
        attachments: [
          {
            filename: "invite.ics",
            content: Buffer.from(ics, "utf8").toString("base64"),
          },
        ],
      });
      if (!result.success) {
        return {
          error: `I created the meeting task ${task.title} on ${dueDate}, but the invite email failed. ${result.error ?? ""}`.trim(),
        };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Scheduled ${task.title} on ${dueDate} and emailed a calendar invite to ${to}.`
      );
    }

    if (name === "get_contact") {
      const found = await requireOneContact(
        supabase,
        workspace_id,
        argStringAny(args, ["lookup", "contact_name", "email"])
      );
      if ("error" in found) return found;
      const { data } = await supabase
        .from("contacts")
        .select(
          "first_name, last_name, organization_name, email, phone, type, notes"
        )
        .eq("id", found.id)
        .eq("workspace_id", workspace_id)
        .maybeSingle();
      if (!data) return { error: "I could not load that contact." };
      const bits = [
        contactSpokenLabel(data as Record<string, unknown>),
        typeof data.type === "string" ? data.type : null,
        typeof data.email === "string" ? data.email : null,
        typeof data.phone === "string" ? data.phone : null,
      ].filter(Boolean);
      const notes =
        typeof data.notes === "string" && data.notes.trim()
          ? ` Notes: ${data.notes.trim().slice(0, 220)}`
          : "";
      return {
        ok: true,
        summary: `${bits.join(", ")}.${notes}`,
      };
    }

    if (name === "delete_contact") {
      const found = await requireOneContact(
        supabase,
        workspace_id,
        argStringAny(args, ["lookup", "contact_name", "email"])
      );
      if ("error" in found) return found;
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", found.id)
        .eq("workspace_id", workspace_id);
      if (error) return { error: error.message };
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Deleted contact ${found.label}.`
      );
    }

    if (name === "list_tasks") {
      const query = sanitizeIlikeQuery(argString(args, "query") ?? "");
      const status = argString(args, "status");
      let q = supabase
        .from("tasks")
        .select("title, status, priority, due_date")
        .eq("workspace_id", workspace_id)
        .order("updated_at", { ascending: false })
        .limit(12);
      if (status && TASK_STATUSES.has(status)) q = q.eq("status", status);
      else if (!query) q = q.in("status", ["todo", "in_progress"]);
      if (query) q = q.ilike("title", `%${query}%`);
      const { data, error } = await q;
      if (error) return { error: error.message };
      const rows = (data ?? []) as Array<{
        title: string;
        status: string;
        due_date: string | null;
      }>;
      if (!rows.length) {
        return { ok: true, summary: "No matching tasks in this workspace." };
      }
      return {
        ok: true,
        summary: `Tasks: ${rows
          .map((r) => `${r.title}, ${r.status}${r.due_date ? `, due ${r.due_date}` : ""}`)
          .join(". ")}.`,
      };
    }

    if (name === "list_invoices") {
      const query = sanitizeIlikeQuery(argString(args, "query") ?? "");
      const status = argString(args, "status");
      let q = supabase
        .from("invoices")
        .select("invoice_number, status, total, due_date")
        .eq("workspace_id", workspace_id)
        .order("updated_at", { ascending: false })
        .limit(12);
      if (status && INVOICE_STATUSES.has(status)) q = q.eq("status", status);
      if (query) q = q.ilike("invoice_number", `%${query}%`);
      const { data, error } = await q;
      if (error) return { error: error.message };
      const rows = (data ?? []) as Array<{
        invoice_number: string;
        status: string;
        total: number;
      }>;
      if (!rows.length) {
        return { ok: true, summary: "No matching invoices in this workspace." };
      }
      return {
        ok: true,
        summary: `Invoices: ${rows
          .map(
            (r) =>
              `${r.invoice_number}, ${r.status}, $${Number(r.total).toFixed(2)}`
          )
          .join(". ")}.`,
      };
    }

    if (name === "list_projects") {
      const query = sanitizeIlikeQuery(argString(args, "query") ?? "");
      const status = argString(args, "status");
      let q = supabase
        .from("projects")
        .select("name, status, due_date")
        .eq("workspace_id", workspace_id)
        .order("updated_at", { ascending: false })
        .limit(12);
      if (status && PROJECT_STATUSES.has(status)) q = q.eq("status", status);
      if (query) q = q.ilike("name", `%${query}%`);
      const { data, error } = await q;
      if (error) return { error: error.message };
      const rows = (data ?? []) as Array<{ name: string; status: string }>;
      if (!rows.length) {
        return { ok: true, summary: "No matching projects in this workspace." };
      }
      return {
        ok: true,
        summary: `Projects: ${rows.map((r) => `${r.name}, ${r.status}`).join(". ")}.`,
      };
    }

    if (name === "list_forms") {
      const query = sanitizeIlikeQuery(argString(args, "query") ?? "");
      let q = supabase
        .from("forms")
        .select("name, status")
        .eq("workspace_id", workspace_id)
        .order("updated_at", { ascending: false })
        .limit(12);
      if (query) q = q.ilike("name", `%${query}%`);
      const { data, error } = await q;
      if (error) return { error: error.message };
      const rows = (data ?? []) as Array<{ name: string; status: string }>;
      if (!rows.length) {
        return { ok: true, summary: "No forms in this workspace." };
      }
      return {
        ok: true,
        summary: `Forms: ${rows.map((r) => `${r.name}, ${r.status}`).join(". ")}.`,
      };
    }

    if (name === "list_contracts") {
      const query = sanitizeIlikeQuery(argString(args, "query") ?? "");
      let q = supabase
        .from("contracts")
        .select("name, status, contract_number")
        .eq("workspace_id", workspace_id)
        .order("updated_at", { ascending: false })
        .limit(12);
      if (query) q = q.ilike("name", `%${query}%`);
      const { data, error } = await q;
      if (error) return { error: error.message };
      const rows = (data ?? []) as Array<{
        name: string;
        status: string;
        contract_number: string;
      }>;
      if (!rows.length) {
        return { ok: true, summary: "No contracts in this workspace." };
      }
      return {
        ok: true,
        summary: `Contracts: ${rows
          .map((r) => `${r.name}, ${r.status}`)
          .join(". ")}.`,
      };
    }

    if (name === "list_leads") {
      const query = sanitizeIlikeQuery(argString(args, "query") ?? "");
      const { data: stages } = await supabase
        .from("pipeline_stages")
        .select("id, name")
        .eq("workspace_id", workspace_id);
      const stageNames = new Map(
        ((stages ?? []) as Array<{ id: string; name: string }>).map((s) => [
          s.id,
          s.name,
        ])
      );
      let q = supabase
        .from("leads")
        .select("title, value, stage_id")
        .eq("workspace_id", workspace_id)
        .is("archived_at", null)
        .order("updated_at", { ascending: false })
        .limit(12);
      if (query) q = q.ilike("title", `%${query}%`);
      const { data, error } = await q;
      if (error) return { error: error.message };
      const rows = (data ?? []) as Array<{
        title: string;
        value: number | null;
        stage_id: string;
      }>;
      if (!rows.length) {
        return { ok: true, summary: "No pipeline leads in this workspace." };
      }
      return {
        ok: true,
        summary: `Leads: ${rows
          .map(
            (r) =>
              `${r.title}, ${stageNames.get(r.stage_id) || "unassigned"}`
          )
          .join(". ")}.`,
      };
    }

    if (name === "list_workflows") {
      const { data, error } = await supabase
        .from("automation_workflows")
        .select("name, is_active, trigger_type")
        .eq("workspace_id", workspace_id)
        .order("updated_at", { ascending: false })
        .limit(12);
      if (error) return { error: error.message };
      const rows = (data ?? []) as Array<{
        name: string;
        is_active: boolean;
        trigger_type: string;
      }>;
      if (!rows.length) {
        return { ok: true, summary: "No automations in this workspace." };
      }
      return {
        ok: true,
        summary: `Workflows: ${rows
          .map((r) => `${r.name}, ${r.is_active ? "on" : "off"}`)
          .join(". ")}.`,
      };
    }

    if (name === "list_submissions") {
      const formName = argString(args, "form_name");
      let formId: string | null = null;
      if (formName) {
        const form = await requireOneForm(supabase, workspace_id, formName);
        if ("error" in form) return form;
        formId = form.id;
      }
      let q = supabase
        .from("form_submissions")
        .select("submitted_at, form:forms(name)")
        .eq("workspace_id", workspace_id)
        .order("submitted_at", { ascending: false })
        .limit(8);
      if (formId) q = q.eq("form_id", formId);
      const { data, error } = await q;
      if (error) return { error: error.message };
      const rows = (data ?? []) as Array<{
        submitted_at: string;
        form?: { name?: string } | { name?: string }[] | null;
      }>;
      if (!rows.length) {
        return { ok: true, summary: "No form submissions in this workspace." };
      }
      const spoken = rows.map((r) => {
        const f = Array.isArray(r.form) ? r.form[0] : r.form;
        const fname = f?.name || "a form";
        const day =
          typeof r.submitted_at === "string"
            ? r.submitted_at.slice(0, 10)
            : "";
        return `${fname}${day ? ` on ${day}` : ""}`;
      });
      return { ok: true, summary: `Submissions: ${spoken.join(". ")}.` };
    }

    if (name === "list_esign") {
      const query = sanitizeIlikeQuery(argString(args, "query") ?? "");
      let q = supabase
        .from("esign_documents")
        .select("name, status, signer_email")
        .eq("workspace_id", workspace_id)
        .order("updated_at", { ascending: false })
        .limit(12);
      if (query) q = q.ilike("name", `%${query}%`);
      const { data, error } = await q;
      if (error) return { error: error.message };
      const rows = (data ?? []) as Array<{
        name: string;
        status: string;
      }>;
      if (!rows.length) {
        return { ok: true, summary: "No e-sign documents in this workspace." };
      }
      return {
        ok: true,
        summary: `E-sign: ${rows.map((r) => `${r.name}, ${r.status}`).join(". ")}.`,
      };
    }

    if (name === "list_knowledge_base") {
      const query = sanitizeIlikeQuery(argString(args, "query") ?? "");
      let q = supabase
        .from("knowledge_base")
        .select("title, category")
        .eq("workspace_id", workspace_id)
        .order("updated_at", { ascending: false })
        .limit(12);
      if (query) {
        q = q.or(`title.ilike.%${query}%,content.ilike.%${query}%`);
      }
      const { data, error } = await q;
      if (error) return { error: error.message };
      const rows = (data ?? []) as Array<{ title: string; category: string }>;
      if (!rows.length) {
        return { ok: true, summary: "No knowledge articles in this workspace." };
      }
      return {
        ok: true,
        summary: `Knowledge: ${rows.map((r) => r.title).join(", ")}.`,
      };
    }

    if (name === "create_lead") {
      const title = argString(args, "title");
      if (!title) return { error: "Need a lead title." };
      const { data: pipeline } = await supabase
        .from("pipelines")
        .select("id")
        .eq("workspace_id", workspace_id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!pipeline?.id) {
        return {
          error:
            "This workspace has no pipeline yet. Open Pipeline once to create it, then ask me again.",
        };
      }
      const stage =
        (await findPipelineStage(
          supabase,
          workspace_id,
          argString(args, "stage_name") || "New Lead"
        )) ||
        (await findPipelineStage(supabase, workspace_id, "New Lead"));
      if (!stage) {
        return { error: "I could not find a pipeline stage in this workspace." };
      }
      let contactId: string | null = null;
      const contactRef = argString(args, "contact_name");
      if (contactRef) {
        const contact = await requireOneContact(
          supabase,
          workspace_id,
          contactRef
        );
        if ("error" in contact) return contact;
        contactId = contact.id;
      }
      const { count } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("stage_id", stage.id)
        .eq("workspace_id", workspace_id);
      const { data, error } = await supabase
        .from("leads")
        .insert({
          workspace_id,
          pipeline_id: pipeline.id,
          stage_id: stage.id,
          title,
          value: argNumber(args, "value"),
          notes: argString(args, "notes"),
          contact_id: contactId,
          position: count ?? 0,
        })
        .select("id, title, stage_id, contact_id")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not create that lead." };
      }
      executeWorkflowsForTrigger(
        "lead_stage_change",
        {
          lead_id: data.id,
          lead: data,
          from_stage_id: null,
          to_stage_id: data.stage_id,
          contact_id: data.contact_id,
          user_id,
        },
        workspace_id
      ).catch((err) => {
        console.error("Error executing lead_stage_change workflows:", err);
      });
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Added lead ${data.title} to ${stage.name}.`
      );
    }

    if (name === "create_knowledge_entry") {
      const title = argString(args, "title");
      const content = argString(args, "content");
      if (!title || !content) {
        return { error: "Need a title and the article text." };
      }
      const { data, error } = await supabase
        .from("knowledge_base")
        .insert({
          workspace_id,
          title: title.slice(0, 200),
          content: content.slice(0, 20000),
          category: (argString(args, "category") || "general").slice(0, 40),
        })
        .select("title")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not save that article." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Saved knowledge article ${data.title}.`
      );
    }

    if (name === "create_email_template") {
      const tmplName = argString(args, "name");
      const subject = argString(args, "subject");
      const body = argString(args, "body");
      if (!tmplName || !subject || !body) {
        return { error: "Need a template name, subject, and body." };
      }
      const safe = body
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const { data, error } = await supabase
        .from("email_templates")
        .insert({
          workspace_id,
          name: tmplName.slice(0, 120),
          subject: subject.slice(0, 500),
          body: `<p>${safe.replace(/\n/g, "<br/>")}</p>`,
          variables: [],
        })
        .select("name")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not create that template." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Created email template ${data.name}.`
      );
    }

    if (name === "remind_esign") {
      const docName = argStringAny(args, ["document_name", "name"]);
      if (!docName) return { error: "Need the e-sign document name." };
      const matches = await findTitleMatches(
        supabase,
        workspace_id,
        "esign_documents",
        "name",
        docName
      );
      const picked = pickUniqueOrAsk(
        matches,
        "I could not find that e-sign document in this workspace."
      );
      if ("error" in picked) return picked;
      const { data: doc } = await supabase
        .from("esign_documents")
        .select(
          "id, workspace_id, name, status, sign_token, signer_name, signer_email, contact_id, reminder_count"
        )
        .eq("id", picked.id)
        .eq("workspace_id", workspace_id)
        .maybeSingle();
      if (!doc?.id) {
        return { error: "I could not find that e-sign document in this workspace." };
      }
      if (!["sent", "viewed"].includes(String(doc.status))) {
        return {
          error:
            "I can only remind while a document is awaiting signature.",
        };
      }
      const admin = createAdminClient();
      const result = await sendSigningReminder(
        admin,
        {
          id: String(doc.id),
          workspace_id,
          name: String(doc.name),
          sign_token: typeof doc.sign_token === "string" ? doc.sign_token : null,
          signer_name:
            typeof doc.signer_name === "string" ? doc.signer_name : null,
          signer_email:
            typeof doc.signer_email === "string" ? doc.signer_email : null,
          contact_id:
            typeof doc.contact_id === "string" ? doc.contact_id : null,
          reminder_count: Number(doc.reminder_count) || 0,
        },
        getAppBaseUrl()
      );
      if (!result.success) {
        return { error: result.error ?? "Could not send that reminder." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Sent a signing reminder for ${String(doc.name)}.`
      );
    }

    if (name === "delete_form") {
      return lunaDeleteWorkspaceRow(
        supabase,
        workspace_id,
        "forms",
        await requireOneForm(
          supabase,
          workspace_id,
          argStringAny(args, ["form_name", "name", "lookup"])
        ),
        name,
        "form"
      );
    }

    if (name === "delete_contract") {
      return lunaDeleteWorkspaceRow(
        supabase,
        workspace_id,
        "contracts",
        await requireOneContract(
          supabase,
          workspace_id,
          argStringAny(args, ["contract_name", "name", "lookup"])
        ),
        name,
        "contract"
      );
    }

    if (name === "delete_workflow") {
      return lunaDeleteWorkspaceRow(
        supabase,
        workspace_id,
        "automation_workflows",
        await requireOneWorkflow(
          supabase,
          workspace_id,
          argStringAny(args, ["name", "workflow_name", "lookup"])
        ),
        name,
        "workflow"
      );
    }

    if (name === "delete_project") {
      const found = await requireOneProject(
        supabase,
        workspace_id,
        argStringAny(args, ["name", "project_name", "lookup"]),
        argStringAny(args, ["project_id", "projectId"])
      );
      if ("error" in found) return found;
      return lunaDeleteWorkspaceRow(
        supabase,
        workspace_id,
        "projects",
        { id: found.id, label: found.name },
        name,
        "project"
      );
    }

    if (name === "delete_invoice") {
      const found = await requireOneInvoice(
        supabase,
        workspace_id,
        argStringAny(args, ["invoice_number", "lookup"]),
        argString(args, "contact_name")
      );
      if ("error" in found) return found;
      return lunaDeleteWorkspaceRow(
        supabase,
        workspace_id,
        "invoices",
        { id: found.id, label: found.invoice_number },
        name,
        "invoice"
      );
    }

    if (name === "delete_lead") {
      return lunaDeleteWorkspaceRow(
        supabase,
        workspace_id,
        "leads",
        await requireOneLead(
          supabase,
          workspace_id,
          argStringAny(args, ["title", "lead_title", "lookup", "name"])
        ),
        name,
        "lead"
      );
    }

    if (name === "delete_esign") {
      return lunaDeleteWorkspaceRow(
        supabase,
        workspace_id,
        "esign_documents",
        await requireOneEsignDoc(
          supabase,
          workspace_id,
          argStringAny(args, ["document_name", "name", "lookup"])
        ),
        name,
        "e-sign document"
      );
    }

    if (name === "delete_email_template") {
      return lunaDeleteWorkspaceRow(
        supabase,
        workspace_id,
        "email_templates",
        await requireOneEmailTemplate(
          supabase,
          workspace_id,
          argStringAny(args, ["name", "template_name", "lookup"])
        ),
        name,
        "email template"
      );
    }

    if (name === "delete_knowledge_entry") {
      return lunaDeleteWorkspaceRow(
        supabase,
        workspace_id,
        "knowledge_base",
        await requireOneKnowledge(
          supabase,
          workspace_id,
          argStringAny(args, ["title", "name", "lookup"])
        ),
        name,
        "knowledge article"
      );
    }

    if (name === "list_job_permits") {
      let q = supabase
        .from("job_permits")
        .select("name, permit_number, status, pulled_on, approved_on, kind")
        .eq("workspace_id", workspace_id)
        .order("created_at", { ascending: false })
        .limit(25);
      const status = argString(args, "status");
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (p: {
          name: string;
          permit_number: string | null;
          status: string;
          pulled_on: string | null;
          approved_on: string | null;
        }) =>
          `${p.name}${p.permit_number ? ` #${p.permit_number}` : ""}: ${p.status}${p.pulled_on ? `, pulled ${p.pulled_on}` : ""}${p.approved_on ? `, approved ${p.approved_on}` : ""}`
      );
      return {
        ok: true,
        summary: lines.length
          ? lines.join(". ")
          : "No permits logged in this workspace.",
      };
    }

    if (name === "log_job_permit") {
      const permitName = argString(args, "name");
      if (!permitName) return { error: "Need a permit or work type name." };
      let projectId: string | null = null;
      const projectRef = argString(args, "project_name");
      if (projectRef) {
        const project = await requireOneProject(
          supabase,
          workspace_id,
          projectRef,
          null
        );
        if ("error" in project) return project;
        projectId = project.id;
      }
      const rawStatus = argString(args, "status") || "needed";
      const status = (PERMIT_STATUSES as readonly string[]).includes(rawStatus)
        ? rawStatus
        : "needed";
      const rawKind = argString(args, "kind") || "city";
      const kind = (PERMIT_KINDS as readonly string[]).includes(rawKind)
        ? rawKind
        : "city";
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("job_permits")
        .insert({
          workspace_id,
          name: permitName.slice(0, 200),
          permit_number: argString(args, "permit_number"),
          status,
          kind,
          project_id: projectId,
          notes: argString(args, "notes"),
          pulled_on: status === "pulled" ? today : null,
          approved_on:
            status === "approved" || status === "passed" ? today : null,
        })
        .select("name, status")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not log that permit." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged permit ${data.name} as ${data.status}.`
      );
    }

    if (name === "list_service_plans") {
      const { data, error } = await supabase
        .from("service_plans")
        .select("name, frequency, next_visit_on, amount, is_active, seasonal_on")
        .eq("workspace_id", workspace_id)
        .order("next_visit_on", { ascending: true })
        .limit(25);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (p: {
          name: string;
          frequency: string;
          next_visit_on: string;
          amount: number;
          is_active: boolean;
          seasonal_on: boolean;
        }) =>
          `${p.name}: ${p.frequency}, next ${p.next_visit_on}${p.is_active ? "" : " (paused)"}${p.seasonal_on ? "" : " (off season)"}`
      );
      return {
        ok: true,
        summary: lines.length
          ? lines.join(". ")
          : "No recurring service plans in this workspace.",
      };
    }

    if (name === "create_service_plan") {
      const planName = argString(args, "name");
      const nextVisit = argString(args, "next_visit_on");
      if (!planName || !nextVisit) {
        return { error: "Need a plan name and next visit date." };
      }
      const contact = await requireOneContact(
        supabase,
        workspace_id,
        argString(args, "contact_name")
      );
      if ("error" in contact) return contact;
      const freqRaw = argString(args, "frequency") || "weekly";
      const frequency = (SERVICE_PLAN_FREQUENCIES as readonly string[]).includes(
        freqRaw
      )
        ? freqRaw
        : "weekly";
      const { data, error } = await supabase
        .from("service_plans")
        .insert({
          workspace_id,
          name: planName.slice(0, 200),
          contact_id: contact.id,
          frequency,
          next_visit_on: nextVisit.slice(0, 10),
          amount: argNumber(args, "amount") ?? 0,
          auto_invoice: args.auto_invoice === true,
          is_active: true,
          seasonal_on: true,
        })
        .select("name, frequency")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not create that plan." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Created recurring plan ${data.name} (${data.frequency}).`
      );
    }

    if (name === "list_insurance_claims") {
      let q = supabase
        .from("insurance_claims")
        .select(
          "status, insurance_company, pricing_mode, adjuster_name, adjuster_at, project:projects(name)"
        )
        .eq("workspace_id", workspace_id)
        .order("created_at", { ascending: false })
        .limit(25);
      const status = argString(args, "status");
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (c: {
          status: string;
          insurance_company: string | null;
          pricing_mode: string;
          adjuster_name: string | null;
          project?: { name: string } | { name: string }[] | null;
        }) => {
          const proj = Array.isArray(c.project) ? c.project[0] : c.project;
          return `${proj?.name ?? "claim"}: ${c.status}${c.insurance_company ? `, ${c.insurance_company}` : ""}${c.pricing_mode === "out_of_pocket" ? " (out of pocket)" : ""}${c.adjuster_name ? `, adjuster ${c.adjuster_name}` : ""}`;
        }
      );
      return {
        ok: true,
        summary: lines.length
          ? lines.join(". ")
          : "No insurance claims in this workspace.",
      };
    }

    if (name === "log_insurance_claim") {
      let projectId: string | null = null;
      const projectRef = argString(args, "project_name");
      if (projectRef) {
        const project = await requireOneProject(
          supabase,
          workspace_id,
          projectRef,
          null
        );
        if ("error" in project) return project;
        projectId = project.id;
      }
      const rawStatus = argString(args, "status") || "filed";
      const status = (CLAIM_STATUSES as readonly string[]).includes(rawStatus)
        ? rawStatus
        : "filed";
      const rawMode = argString(args, "pricing_mode") || "insurance";
      const pricing_mode = (CLAIM_PRICING_MODES as readonly string[]).includes(
        rawMode
      )
        ? rawMode
        : "insurance";
      const { data, error } = await supabase
        .from("insurance_claims")
        .insert({
          workspace_id,
          project_id: projectId,
          insurance_company: argString(args, "insurance_company"),
          status,
          pricing_mode,
          adjuster_name: argString(args, "adjuster_name"),
          notes: argString(args, "notes"),
        })
        .select("status, insurance_company")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not log that claim." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged claim as ${data.status}${data.insurance_company ? ` with ${data.insurance_company}` : ""}. Policy and claim numbers stay on the Claims page, not in this chat.`
      );
    }

    if (name === "list_material_orders") {
      let q = supabase
        .from("material_orders")
        .select("name, material_type, status, delivery_on, color")
        .eq("workspace_id", workspace_id)
        .order("created_at", { ascending: false })
        .limit(25);
      const status = argString(args, "status");
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (o: {
          name: string;
          material_type: string;
          status: string;
          delivery_on: string | null;
          color: string | null;
        }) =>
          `${o.name} (${o.material_type}${o.color ? `, ${o.color}` : ""}): ${o.status}${o.delivery_on ? `, delivery ${o.delivery_on}` : ""}`
      );
      return {
        ok: true,
        summary: lines.length
          ? lines.join(". ")
          : "No material orders in this workspace.",
      };
    }

    if (name === "log_material_order") {
      const orderName = argString(args, "name");
      if (!orderName) return { error: "Need a material name (for example, shingles or dumpster)." };
      let projectId: string | null = null;
      const projectRef = argString(args, "project_name");
      if (projectRef) {
        const project = await requireOneProject(
          supabase,
          workspace_id,
          projectRef,
          null
        );
        if ("error" in project) return project;
        projectId = project.id;
      }
      const rawStatus = argString(args, "status") || "needed";
      const status = (MATERIAL_ORDER_STATUSES as readonly string[]).includes(
        rawStatus
      )
        ? rawStatus
        : "needed";
      const rawType = argString(args, "material_type") || "shingles";
      const material_type = (MATERIAL_TYPES as readonly string[]).includes(rawType)
        ? rawType
        : "other";
      const { data, error } = await supabase
        .from("material_orders")
        .insert({
          workspace_id,
          project_id: projectId,
          name: orderName.slice(0, 200),
          material_type,
          status,
          color: argString(args, "color"),
          quantity: argString(args, "quantity"),
          vendor: argString(args, "vendor"),
          delivery_on: argString(args, "delivery_on"),
          dropoff_notes: argString(args, "dropoff_notes"),
          notes: argString(args, "notes"),
        })
        .select("name, status")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not log that material order." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged material order ${data.name} as ${data.status}.`
      );
    }

    if (name === "list_finish_specs") {
      const { data, error } = await supabase
        .from("job_finish_specs")
        .select("room_or_surface, brand, color_name, color_code, sheen, client_signed_off_at")
        .eq("workspace_id", workspace_id)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (s: {
          room_or_surface: string;
          brand: string | null;
          color_name: string | null;
          color_code: string | null;
          sheen: string | null;
          client_signed_off_at: string | null;
        }) =>
          `${s.room_or_surface}: ${[s.brand, s.color_name, s.color_code, s.sheen].filter(Boolean).join(" ")}${s.client_signed_off_at ? " (signed off)" : " (awaiting sign-off)"}`
      );
      return {
        ok: true,
        summary: lines.length ? lines.join(". ") : "No color or finish specs in this workspace.",
      };
    }

    if (name === "log_finish_spec") {
      const room = argString(args, "room_or_surface") || argString(args, "name");
      if (!room) return { error: "Need a room or surface name." };
      let projectId: string | null = null;
      const projectRef = argString(args, "project_name");
      if (projectRef) {
        const project = await requireOneProject(
          supabase,
          workspace_id,
          projectRef,
          null
        );
        if ("error" in project) return project;
        projectId = project.id;
      }
      const sheenRaw = argString(args, "sheen");
      const sheen = sheenRaw && (PAINT_SHEENS as readonly string[]).includes(sheenRaw)
        ? sheenRaw
        : null;
      const { data, error } = await supabase
        .from("job_finish_specs")
        .insert({
          workspace_id,
          project_id: projectId,
          room_or_surface: room.slice(0, 200),
          brand: argString(args, "brand"),
          color_name: argString(args, "color_name"),
          color_code: argString(args, "color_code"),
          sheen,
          quantity: argString(args, "quantity"),
          supplier: argString(args, "supplier"),
          match_notes: argString(args, "match_notes"),
        })
        .select("room_or_surface")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not log that color spec." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged finish spec for ${data.room_or_surface}.`
      );
    }

    if (name === "list_prep_items") {
      const { data, error } = await supabase
        .from("job_prep_items")
        .select("kind, status, billed_separately, notes")
        .eq("workspace_id", workspace_id)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (p: { kind: string; status: string; billed_separately: boolean; notes: string | null }) =>
          `${p.kind}: ${p.status}${p.billed_separately ? " (billed separately)" : ""}`
      );
      return {
        ok: true,
        summary: lines.length ? lines.join(". ") : "No surface prep items in this workspace.",
      };
    }

    if (name === "log_prep_item") {
      const kindRaw = argString(args, "kind") || "other";
      const kind = (PREP_KINDS as readonly string[]).includes(kindRaw) ? kindRaw : "other";
      const statusRaw = argString(args, "status") || "todo";
      const status = (PREP_STATUSES as readonly string[]).includes(statusRaw)
        ? statusRaw
        : "todo";
      let projectId: string | null = null;
      const projectRef = argString(args, "project_name");
      if (projectRef) {
        const project = await requireOneProject(
          supabase,
          workspace_id,
          projectRef,
          null
        );
        if ("error" in project) return project;
        projectId = project.id;
      }
      const { data, error } = await supabase
        .from("job_prep_items")
        .insert({
          workspace_id,
          project_id: projectId,
          kind,
          status,
          billed_separately: args.billed_separately === true,
          notes: argString(args, "notes"),
        })
        .select("kind, status")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not log that prep item." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged ${data.kind} prep as ${data.status}.`
      );
    }

    if (name === "list_hoa_color_approvals") {
      const { data, error } = await supabase
        .from("hoa_color_approvals")
        .select("status, scheme_notes")
        .eq("workspace_id", workspace_id)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (h: { status: string; scheme_notes: string | null }) =>
          `${h.status}${h.scheme_notes ? `: ${h.scheme_notes}` : ""}`
      );
      return {
        ok: true,
        summary: lines.length
          ? lines.join(". ")
          : "No HOA color approvals in this workspace.",
      };
    }

    if (name === "log_hoa_color_approval") {
      const statusRaw = argString(args, "status") || "needed";
      const status = (HOA_COLOR_STATUSES as readonly string[]).includes(statusRaw)
        ? statusRaw
        : "needed";
      let projectId: string | null = null;
      const projectRef = argString(args, "project_name");
      if (projectRef) {
        const project = await requireOneProject(
          supabase,
          workspace_id,
          projectRef,
          null
        );
        if ("error" in project) return project;
        projectId = project.id;
      }
      const { data, error } = await supabase
        .from("hoa_color_approvals")
        .insert({
          workspace_id,
          project_id: projectId,
          status,
          scheme_notes: argString(args, "scheme_notes") || argString(args, "notes"),
        })
        .select("status")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not log that HOA approval." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged HOA color approval as ${data.status}.`
      );
    }

    if (name === "list_pest_treatments") {
      const { data, error } = await supabase
        .from("pest_treatments")
        .select("product_name, method, target_pest, treated_on, status, retreatment_until")
        .eq("workspace_id", workspace_id)
        .order("treated_on", { ascending: false })
        .limit(25);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (t: {
          product_name: string;
          method: string;
          target_pest: string | null;
          treated_on: string;
          status: string;
          retreatment_until: string | null;
        }) =>
          `${t.product_name} (${t.method}${t.target_pest ? `, ${t.target_pest}` : ""}): ${t.status} on ${t.treated_on}${t.retreatment_until ? `, guarantee through ${t.retreatment_until}` : ""}`
      );
      return {
        ok: true,
        summary: lines.length
          ? lines.join(". ")
          : "No pest treatments logged in this workspace.",
      };
    }

    if (name === "log_pest_treatment") {
      const product = argString(args, "product_name");
      if (!product) return { error: "Need a product name." };
      const methodRaw = argString(args, "method") || "other";
      const method = (TREATMENT_METHODS as readonly string[]).includes(methodRaw)
        ? methodRaw
        : "other";
      const treatedOn =
        argString(args, "treated_on") || new Date().toISOString().slice(0, 10);
      const guaranteeDays = argNumber(args, "guarantee_days");
      let retreatmentUntil: string | null = null;
      if (guaranteeDays && guaranteeDays > 0) {
        const d = new Date(`${treatedOn.slice(0, 10)}T00:00:00`);
        d.setDate(d.getDate() + guaranteeDays);
        retreatmentUntil = d.toISOString().slice(0, 10);
      }
      let projectId: string | null = null;
      const projectRef = argString(args, "project_name");
      if (projectRef) {
        const project = await requireOneProject(
          supabase,
          workspace_id,
          projectRef,
          null
        );
        if ("error" in project) return project;
        projectId = project.id;
      }
      const { data, error } = await supabase
        .from("pest_treatments")
        .insert({
          workspace_id,
          project_id: projectId,
          product_name: product.slice(0, 200),
          epa_number: argString(args, "epa_number"),
          method,
          quantity: argString(args, "quantity"),
          target_pest: argString(args, "target_pest"),
          treatment_area: argString(args, "treatment_area"),
          treated_on: treatedOn.slice(0, 10),
          guarantee_days: guaranteeDays,
          retreatment_until: retreatmentUntil,
          status: retreatmentUntil ? "guarantee_open" : "logged",
          notes: argString(args, "notes"),
        })
        .select("product_name, status")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not log that treatment." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged treatment ${data.product_name} as ${data.status}.`
      );
    }

    if (name === "list_property_access") {
      const { data, error } = await supabase
        .from("property_access")
        .select(
          "entry_method, has_entry_code, pets_notes, child_safety, chemical_sensitive, special_instructions, contact:contacts(first_name, last_name, organization_name, type)"
        )
        .eq("workspace_id", workspace_id)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) return { error: error.message };
      type AccessContact = {
        first_name?: string | null;
        last_name?: string | null;
        organization_name?: string | null;
      };
      const lines = (data ?? []).map(
        (a: {
          entry_method: string;
          has_entry_code: boolean;
          pets_notes: string | null;
          child_safety: string | null;
          chemical_sensitive: string | null;
          special_instructions: string | null;
          contact?: AccessContact | AccessContact[] | null;
        }) => {
          const c = Array.isArray(a.contact) ? a.contact[0] : a.contact;
          const who = c
            ? [c.first_name, c.last_name].filter(Boolean).join(" ") ||
              c.organization_name ||
              "customer"
            : "customer";
          return `${who}: ${a.entry_method}${a.has_entry_code ? ", access code on file (not spoken)" : ""}${a.pets_notes ? ", pet notes on file" : ""}${a.child_safety || a.chemical_sensitive ? ", safety notes on file" : ""}`;
        }
      );
      return {
        ok: true,
        summary: lines.length
          ? `${lines.join(". ")} Entry codes are not included.`
          : "No property access notes in this workspace.",
      };
    }

    if (name === "log_property_access") {
      const contact = await requireOneContact(
        supabase,
        workspace_id,
        argString(args, "contact_name")
      );
      if ("error" in contact) return contact;
      const methodRaw = argString(args, "entry_method") || "occupant";
      const entry_method = (ACCESS_ENTRY_METHODS as readonly string[]).includes(
        methodRaw
      )
        ? methodRaw
        : "occupant";
      const { data, error } = await supabase
        .from("property_access")
        .insert({
          workspace_id,
          contact_id: contact.id,
          entry_method,
          has_entry_code: args.has_entry_code === true,
          pets_notes: argString(args, "pets_notes"),
          child_safety: argString(args, "child_safety"),
          chemical_sensitive: argString(args, "chemical_sensitive"),
          special_instructions: argString(args, "special_instructions"),
        })
        .select("entry_method")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not save access notes." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Saved access notes (${data.entry_method}). Codes were not stored from this chat.`
      );
    }

    if (name === "list_inspection_findings") {
      const { data, error } = await supabase
        .from("inspection_findings")
        .select("system, title, severity, status")
        .eq("workspace_id", workspace_id)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (f: {
          system: string;
          title: string;
          severity: string;
          status: string;
        }) => `${f.severity} ${f.system}: ${f.title} (${f.status})`
      );
      return {
        ok: true,
        summary: lines.length
          ? lines.join(". ")
          : "No inspection findings in this workspace.",
      };
    }

    if (name === "log_inspection_finding") {
      const title = argString(args, "title");
      if (!title) return { error: "Need a finding title." };
      const systemRaw = argString(args, "system") || "other";
      const system = (FINDING_SYSTEMS as readonly string[]).includes(systemRaw)
        ? systemRaw
        : "other";
      const sevRaw = argString(args, "severity") || "info";
      const severity = (FINDING_SEVERITIES as readonly string[]).includes(sevRaw)
        ? sevRaw
        : "info";
      const stRaw = argString(args, "status") || "open";
      const status = (FINDING_STATUSES as readonly string[]).includes(stRaw)
        ? stRaw
        : "open";
      let projectId: string | null = null;
      const projectRef = argString(args, "project_name");
      if (projectRef) {
        const project = await requireOneProject(
          supabase,
          workspace_id,
          projectRef,
          null
        );
        if ("error" in project) return project;
        projectId = project.id;
      }
      const { data, error } = await supabase
        .from("inspection_findings")
        .insert({
          workspace_id,
          project_id: projectId,
          title: title.slice(0, 200),
          system,
          severity,
          status,
          notes: argString(args, "notes"),
          moisture_reading: argString(args, "moisture_reading"),
          thermal_notes: argString(args, "thermal_notes"),
        })
        .select("title, severity")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not log that finding." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged ${data.severity} finding: ${data.title}.`
      );
    }

    if (name === "list_inspection_reports") {
      const { data, error } = await supabase
        .from("inspection_reports")
        .select("title, status, due_at")
        .eq("workspace_id", workspace_id)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (r: { title: string; status: string; due_at: string | null }) =>
          `${r.title}: ${r.status}${r.due_at ? `, due ${r.due_at}` : ""}`
      );
      return {
        ok: true,
        summary: lines.length
          ? `${lines.join(". ")} Share links are not spoken.`
          : "No inspection reports in this workspace.",
      };
    }

    if (name === "log_inspection_report") {
      const title = argString(args, "title");
      if (!title) return { error: "Need a report title." };
      const stRaw = argString(args, "status") || "draft";
      const status = (REPORT_STATUSES as readonly string[]).includes(stRaw)
        ? stRaw
        : "draft";
      let projectId: string | null = null;
      const projectRef = argString(args, "project_name");
      if (projectRef) {
        const project = await requireOneProject(
          supabase,
          workspace_id,
          projectRef,
          null
        );
        if ("error" in project) return project;
        projectId = project.id;
      }
      const { data, error } = await supabase
        .from("inspection_reports")
        .insert({
          workspace_id,
          project_id: projectId,
          title: title.slice(0, 200),
          summary: argString(args, "summary"),
          agent_name: argString(args, "agent_name"),
          seller_agent_name: argString(args, "seller_agent_name"),
          property_type: argString(args, "property_type"),
          property_size: argString(args, "property_size"),
          closing_on: argString(args, "closing_on"),
          due_at: argString(args, "due_at"),
          status,
        })
        .select("title, status")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not log that report." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged report ${data.title} as ${data.status}. The share link is on Reports, not spoken.`
      );
    }

    if (name === "list_inspection_addons") {
      const { data, error } = await supabase
        .from("inspection_addons")
        .select("kind, status, specialist_name")
        .eq("workspace_id", workspace_id)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (a: {
          kind: string;
          status: string;
          specialist_name: string | null;
        }) =>
          `${a.kind}: ${a.status}${a.specialist_name ? ` (${a.specialist_name})` : ""}`
      );
      return {
        ok: true,
        summary: lines.length
          ? lines.join(". ")
          : "No inspection add-ons in this workspace.",
      };
    }

    if (name === "log_inspection_addon") {
      const kindRaw = argString(args, "kind") || "other";
      const kind = (ADDON_KINDS as readonly string[]).includes(kindRaw)
        ? kindRaw
        : "other";
      const stRaw = argString(args, "status") || "ordered";
      const status = (ADDON_STATUSES as readonly string[]).includes(stRaw)
        ? stRaw
        : "ordered";
      let projectId: string | null = null;
      const projectRef = argString(args, "project_name");
      if (projectRef) {
        const project = await requireOneProject(
          supabase,
          workspace_id,
          projectRef,
          null
        );
        if ("error" in project) return project;
        projectId = project.id;
      }
      const { data, error } = await supabase
        .from("inspection_addons")
        .insert({
          workspace_id,
          project_id: projectId,
          kind,
          status,
          specialist_name: argString(args, "specialist_name"),
          result_summary: argString(args, "result_summary"),
          due_on: argString(args, "due_on"),
          notes: argString(args, "notes"),
        })
        .select("kind, status")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not log that add-on." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged ${data.kind} add-on as ${data.status}.`
      );
    }

    if (name === "list_rental_assets") {
      const { data, error } = await supabase
        .from("rental_assets")
        .select("name, category, location, status")
        .eq("workspace_id", workspace_id)
        .order("name")
        .limit(40);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (a: {
          name: string;
          category: string;
          location: string;
          status: string;
        }) => `${a.name}: ${a.status} (${a.category}, ${a.location})`
      );
      return {
        ok: true,
        summary: lines.length
          ? lines.join(". ")
          : "No rental assets in this workspace.",
      };
    }

    if (name === "log_rental_asset") {
      const assetName = argString(args, "name");
      if (!assetName) return { error: "Need an asset name." };
      const catRaw = argString(args, "category") || "other";
      const category = (ASSET_CATEGORIES as readonly string[]).includes(catRaw)
        ? catRaw
        : "other";
      const locRaw = argString(args, "location") || "yard";
      const location = (ASSET_LOCATIONS as readonly string[]).includes(locRaw)
        ? locRaw
        : "yard";
      const stRaw = argString(args, "status") || "available";
      const status = (ASSET_STATUSES as readonly string[]).includes(stRaw)
        ? stRaw
        : "available";
      const { data, error } = await supabase
        .from("rental_assets")
        .insert({
          workspace_id,
          name: assetName.slice(0, 200),
          sku: argString(args, "sku"),
          category,
          location,
          status,
          hourly_rate: Number(args.hourly_rate) || 0,
          daily_rate: Number(args.daily_rate) || 0,
          weekly_rate: Number(args.weekly_rate) || 0,
          notes: argString(args, "notes"),
        })
        .select("name, status")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not save that asset." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged fleet asset ${data.name} as ${data.status}.`
      );
    }

    if (name === "list_rental_reservations") {
      const { data, error } = await supabase
        .from("rental_reservations")
        .select("starts_on, ends_on, status, deposit_amount, pickup_method")
        .eq("workspace_id", workspace_id)
        .order("starts_on", { ascending: false })
        .limit(25);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (r: {
          starts_on: string;
          ends_on: string;
          status: string;
          deposit_amount: number;
          pickup_method: string;
        }) =>
          `${r.starts_on} to ${r.ends_on}: ${r.status} (${r.pickup_method}, deposit ${r.deposit_amount})`
      );
      return {
        ok: true,
        summary: lines.length
          ? `${lines.join(". ")} Card numbers are not stored.`
          : "No rental reservations in this workspace.",
      };
    }

    if (name === "log_rental_reservation") {
      const startsOn = argString(args, "starts_on");
      const endsOn = argString(args, "ends_on");
      if (!startsOn || !endsOn) return { error: "Need start and end dates." };
      const pickRaw = argString(args, "pickup_method") || "pickup";
      const pickup_method = (PICKUP_METHODS as readonly string[]).includes(
        pickRaw
      )
        ? pickRaw
        : "pickup";
      const rateRaw = argString(args, "rate_type") || "daily";
      const rate_type = (RATE_TYPES as readonly string[]).includes(rateRaw)
        ? rateRaw
        : "daily";
      const stRaw = argString(args, "status") || "hold";
      const status = (RESERVATION_STATUSES as readonly string[]).includes(stRaw)
        ? stRaw
        : "hold";
      let contactId: string | null = null;
      const contactRef = argString(args, "contact_name");
      if (contactRef) {
        const contact = await requireOneContact(
          supabase,
          workspace_id,
          contactRef
        );
        if ("error" in contact) return contact;
        contactId = contact.id;
      }
      let assetId: string | null = null;
      const assetRef = argString(args, "asset_name");
      if (assetRef) {
        const { data: assets } = await supabase
          .from("rental_assets")
          .select("id, name")
          .eq("workspace_id", workspace_id)
          .ilike("name", `%${assetRef}%`)
          .limit(5);
        if (!assets?.length) {
          return { error: "I could not find that asset in this workspace." };
        }
        if (assets.length > 1) {
          return {
            error: `Which asset: ${assets.map((a: { name: string }) => a.name).join(", ")}?`,
          };
        }
        assetId = assets[0].id;
      }
      const { data, error } = await supabase
        .from("rental_reservations")
        .insert({
          workspace_id,
          contact_id: contactId,
          asset_id: assetId,
          starts_on: startsOn.slice(0, 10),
          ends_on: endsOn.slice(0, 10),
          pickup_method,
          job_site_address: argString(args, "job_site_address"),
          status,
          rate_type,
          rate_amount: Number(args.rate_amount) || 0,
          deposit_amount: Number(args.deposit_amount) || 0,
          notes: argString(args, "notes"),
        })
        .select("starts_on, ends_on, status")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not save that reservation." };
      }
      if (assetId && (status === "hold" || status === "reserved")) {
        await supabase
          .from("rental_assets")
          .update({ status: "reserved" })
          .eq("id", assetId)
          .eq("workspace_id", workspace_id);
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged rental ${data.starts_on} to ${data.ends_on} as ${data.status}. Deposit is an amount only.`
      );
    }

    if (name === "list_rental_maintenance") {
      const { data, error } = await supabase
        .from("rental_maintenance")
        .select("title, status, due_on")
        .eq("workspace_id", workspace_id)
        .order("due_on", { ascending: true })
        .limit(25);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (m: { title: string; status: string; due_on: string | null }) =>
          `${m.title}: ${m.status}${m.due_on ? `, due ${m.due_on}` : ""}`
      );
      return {
        ok: true,
        summary: lines.length
          ? lines.join(". ")
          : "No rental maintenance records in this workspace.",
      };
    }

    if (name === "log_rental_maintenance") {
      const title = argString(args, "title");
      if (!title) return { error: "Need a service title." };
      const stRaw = argString(args, "status") || "scheduled";
      const status = (MAINT_STATUSES as readonly string[]).includes(stRaw)
        ? stRaw
        : "scheduled";
      let assetId: string | null = null;
      const assetRef = argString(args, "asset_name");
      if (assetRef) {
        const { data: assets } = await supabase
          .from("rental_assets")
          .select("id, name")
          .eq("workspace_id", workspace_id)
          .ilike("name", `%${assetRef}%`)
          .limit(5);
        if (!assets?.length) {
          return { error: "I could not find that asset in this workspace." };
        }
        if (assets.length > 1) {
          return {
            error: `Which asset: ${assets.map((a: { name: string }) => a.name).join(", ")}?`,
          };
        }
        assetId = assets[0].id;
      }
      const { data, error } = await supabase
        .from("rental_maintenance")
        .insert({
          workspace_id,
          asset_id: assetId,
          title: title.slice(0, 200),
          status,
          due_on: argString(args, "due_on"),
          hours_at_service:
            args.hours_at_service == null
              ? null
              : Number(args.hours_at_service),
          cost: args.cost == null ? null : Number(args.cost),
          notes: argString(args, "notes"),
        })
        .select("title, status")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not log that service." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged maintenance ${data.title} as ${data.status}.`
      );
    }

    if (name === "list_construction_change_orders") {
      const { data, error } = await supabase
        .from("construction_change_orders")
        .select("title, status, cost_impact")
        .eq("workspace_id", workspace_id)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (c: { title: string; status: string; cost_impact: number }) =>
          `${c.title}: ${c.status} (impact ${c.cost_impact})`
      );
      return {
        ok: true,
        summary: lines.length
          ? lines.join(". ")
          : "No change orders in this workspace.",
      };
    }

    if (name === "log_construction_change_order") {
      const title = argString(args, "title");
      if (!title) return { error: "Need a change-order title." };
      const stRaw = argString(args, "status") || "draft";
      const status = (CHANGE_ORDER_STATUSES as readonly string[]).includes(stRaw)
        ? stRaw
        : "draft";
      let projectId: string | null = null;
      const projectRef = argString(args, "project_name");
      if (projectRef) {
        const project = await requireOneProject(
          supabase,
          workspace_id,
          projectRef,
          null
        );
        if ("error" in project) return project;
        projectId = project.id;
      }
      const { data, error } = await supabase
        .from("construction_change_orders")
        .insert({
          workspace_id,
          project_id: projectId,
          title: title.slice(0, 200),
          status,
          cost_impact: Number(args.cost_impact) || 0,
          notes: argString(args, "notes"),
        })
        .select("title, status")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not log that change order." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged change order ${data.title} as ${data.status}. Extra work waits on approval.`
      );
    }

    if (name === "list_construction_subs") {
      const { data, error } = await supabase
        .from("construction_subs")
        .select("name, trade, coi_expires")
        .eq("workspace_id", workspace_id)
        .order("name")
        .limit(40);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (s: { name: string; trade: string; coi_expires: string | null }) =>
          `${s.name} (${s.trade})${s.coi_expires ? `, COI ${s.coi_expires}` : ""}`
      );
      return {
        ok: true,
        summary: lines.length
          ? `${lines.join(". ")} License numbers are not spoken.`
          : "No subcontractors in this workspace.",
      };
    }

    if (name === "log_construction_sub") {
      const subName = argString(args, "name");
      if (!subName) return { error: "Need a subcontractor name." };
      const tradeRaw = argString(args, "trade") || "other";
      const trade = (SUB_TRADES as readonly string[]).includes(tradeRaw)
        ? tradeRaw
        : "other";
      const { data, error } = await supabase
        .from("construction_subs")
        .insert({
          workspace_id,
          name: subName.slice(0, 200),
          trade,
          phone: argString(args, "phone"),
          email: argString(args, "email"),
          coi_expires: argString(args, "coi_expires"),
          rate_notes: argString(args, "rate_notes"),
        })
        .select("name, trade")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not save that sub." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged sub ${data.name} (${data.trade}). Do not store license numbers here.`
      );
    }

    if (name === "list_construction_phases") {
      const { data, error } = await supabase
        .from("construction_phases")
        .select("kind, status, delay_cause")
        .eq("workspace_id", workspace_id)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (p: {
          kind: string;
          status: string;
          delay_cause: string | null;
        }) =>
          `${p.kind}: ${p.status}${p.delay_cause ? ` (${p.delay_cause})` : ""}`
      );
      return {
        ok: true,
        summary: lines.length
          ? lines.join(". ")
          : "No construction phases in this workspace.",
      };
    }

    if (name === "log_construction_phase") {
      const kindRaw = argString(args, "kind") || "finish";
      const kind = (PHASE_KINDS as readonly string[]).includes(kindRaw)
        ? kindRaw
        : "finish";
      const stRaw = argString(args, "status") || "planned";
      const status = (PHASE_STATUSES as readonly string[]).includes(stRaw)
        ? stRaw
        : "planned";
      const delayRaw = argString(args, "delay_cause");
      const delay_cause =
        delayRaw && (DELAY_CAUSES as readonly string[]).includes(delayRaw)
          ? delayRaw
          : null;
      let projectId: string | null = null;
      const projectRef = argString(args, "project_name");
      if (projectRef) {
        const project = await requireOneProject(
          supabase,
          workspace_id,
          projectRef,
          null
        );
        if ("error" in project) return project;
        projectId = project.id;
      }
      let subId: string | null = null;
      const subRef = argString(args, "sub_name");
      if (subRef) {
        const { data: found } = await supabase
          .from("construction_subs")
          .select("id, name")
          .eq("workspace_id", workspace_id)
          .ilike("name", `%${subRef}%`)
          .limit(5);
        if (!found?.length) {
          return { error: "I could not find that sub in this workspace." };
        }
        if (found.length > 1) {
          return {
            error: `Which sub: ${found.map((s: { name: string }) => s.name).join(", ")}?`,
          };
        }
        subId = found[0].id;
      }
      const { data, error } = await supabase
        .from("construction_phases")
        .insert({
          workspace_id,
          project_id: projectId,
          sub_id: subId,
          kind,
          status,
          delay_cause,
          percent_complete: Number(args.percent_complete) || 0,
          starts_on: argString(args, "starts_on"),
          ends_on: argString(args, "ends_on"),
        })
        .select("kind, status")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not log that phase." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged ${data.kind} phase as ${data.status}.`
      );
    }

    if (name === "list_construction_daily_logs") {
      const { data, error } = await supabase
        .from("construction_daily_logs")
        .select("logged_on, weather, work_completed")
        .eq("workspace_id", workspace_id)
        .order("logged_on", { ascending: false })
        .limit(25);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (l: {
          logged_on: string;
          weather: string | null;
          work_completed: string | null;
        }) =>
          `${l.logged_on}${l.weather ? ` ${l.weather}` : ""}${
            l.work_completed ? `: ${l.work_completed}` : ""
          }`
      );
      return {
        ok: true,
        summary: lines.length
          ? lines.join(". ")
          : "No daily logs in this workspace.",
      };
    }

    if (name === "log_construction_daily_log") {
      let projectId: string | null = null;
      const projectRef = argString(args, "project_name");
      if (projectRef) {
        const project = await requireOneProject(
          supabase,
          workspace_id,
          projectRef,
          null
        );
        if ("error" in project) return project;
        projectId = project.id;
      }
      const { data, error } = await supabase
        .from("construction_daily_logs")
        .insert({
          workspace_id,
          project_id: projectId,
          logged_on:
            argString(args, "logged_on") ||
            new Date().toISOString().slice(0, 10),
          weather: argString(args, "weather"),
          crew_notes: argString(args, "crew_notes"),
          work_completed: argString(args, "work_completed"),
          issues: argString(args, "issues"),
          safety_notes: argString(args, "safety_notes"),
        })
        .select("logged_on")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not log that day." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged job site notes for ${data.logged_on}.`
      );
    }

    if (name === "list_construction_draws") {
      const { data, error } = await supabase
        .from("construction_draws")
        .select("kind, status, amount, lien_waiver")
        .eq("workspace_id", workspace_id)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (d: {
          kind: string;
          status: string;
          amount: number;
          lien_waiver: string;
        }) => `${d.kind}: ${d.status} (${d.amount}, waiver ${d.lien_waiver})`
      );
      return {
        ok: true,
        summary: lines.length
          ? `${lines.join(". ")} Card numbers are not stored.`
          : "No draws in this workspace.",
      };
    }

    if (name === "log_construction_draw") {
      const kindRaw = argString(args, "kind") || "progress";
      const kind = (DRAW_KINDS as readonly string[]).includes(kindRaw)
        ? kindRaw
        : "progress";
      const stRaw = argString(args, "status") || "draft";
      const status = (DRAW_STATUSES as readonly string[]).includes(stRaw)
        ? stRaw
        : "draft";
      const lienRaw = argString(args, "lien_waiver") || "needed";
      const lien_waiver = (LIEN_WAIVER_STATUSES as readonly string[]).includes(
        lienRaw
      )
        ? lienRaw
        : "needed";
      let projectId: string | null = null;
      const projectRef = argString(args, "project_name");
      if (projectRef) {
        const project = await requireOneProject(
          supabase,
          workspace_id,
          projectRef,
          null
        );
        if ("error" in project) return project;
        projectId = project.id;
      }
      const { data, error } = await supabase
        .from("construction_draws")
        .insert({
          workspace_id,
          project_id: projectId,
          kind,
          status,
          amount: Number(args.amount) || 0,
          percent_complete: Number(args.percent_complete) || 0,
          due_on: argString(args, "due_on"),
          lien_waiver,
          notes: argString(args, "notes"),
        })
        .select("kind, status")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not log that draw." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged ${data.kind} draw as ${data.status}. Amount only — no cards.`
      );
    }

    if (name === "list_shop_designs") {
      const { data, error } = await supabase
        .from("shop_designs")
        .select("title, version, status")
        .eq("workspace_id", workspace_id)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (d: { title: string; version: number; status: string }) =>
          `${d.title} v${d.version}: ${d.status}`
      );
      return {
        ok: true,
        summary: lines.length
          ? lines.join(". ")
          : "No shop drawings in this workspace.",
      };
    }

    if (name === "log_shop_design") {
      const title = argString(args, "title");
      if (!title) return { error: "Need a drawing title." };
      const stRaw = argString(args, "status") || "draft";
      const status = (SHOP_DESIGN_STATUSES as readonly string[]).includes(stRaw)
        ? stRaw
        : "draft";
      let projectId: string | null = null;
      const projectRef = argString(args, "project_name");
      if (projectRef) {
        const project = await requireOneProject(
          supabase,
          workspace_id,
          projectRef,
          null
        );
        if ("error" in project) return project;
        projectId = project.id;
      }
      const { data, error } = await supabase
        .from("shop_designs")
        .insert({
          workspace_id,
          project_id: projectId,
          title: title.slice(0, 200),
          status,
          version: Number(args.version) || 1,
          dimensions: argString(args, "dimensions"),
          joinery_notes: argString(args, "joinery_notes"),
        })
        .select("title, status")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not log that drawing." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged drawing ${data.title} as ${data.status}.`
      );
    }

    if (name === "list_shop_selections") {
      const { data, error } = await supabase
        .from("shop_selections")
        .select("kind, name, cost, signed_off_at")
        .eq("workspace_id", workspace_id)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (s: {
          kind: string;
          name: string;
          cost: number;
          signed_off_at: string | null;
        }) =>
          `${s.kind} ${s.name}${s.signed_off_at ? " signed off" : " needs sign-off"}`
      );
      return {
        ok: true,
        summary: lines.length
          ? lines.join(". ")
          : "No material selections in this workspace.",
      };
    }

    if (name === "log_shop_selection") {
      const selName = argString(args, "name");
      if (!selName) return { error: "Need a selection name." };
      const kindRaw = argString(args, "kind") || "species";
      const kind = (SHOP_SELECTION_KINDS as readonly string[]).includes(kindRaw)
        ? kindRaw
        : "species";
      let projectId: string | null = null;
      const projectRef = argString(args, "project_name");
      if (projectRef) {
        const project = await requireOneProject(
          supabase,
          workspace_id,
          projectRef,
          null
        );
        if ("error" in project) return project;
        projectId = project.id;
      }
      const { data, error } = await supabase
        .from("shop_selections")
        .insert({
          workspace_id,
          project_id: projectId,
          kind,
          name: selName.slice(0, 200),
          cost: Number(args.cost) || 0,
          signed_off_at: args.signed_off ? new Date().toISOString() : null,
          notes: argString(args, "notes"),
        })
        .select("name, kind")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not log that selection." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged ${data.kind} selection ${data.name}.`
      );
    }

    if (name === "list_shop_queue") {
      const { data, error } = await supabase
        .from("shop_queue")
        .select("title, stage, fab_step, craftsman_name")
        .eq("workspace_id", workspace_id)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (q: {
          title: string;
          stage: string;
          fab_step: string | null;
          craftsman_name: string | null;
        }) =>
          `${q.title}: ${q.stage}${q.fab_step ? ` (${q.fab_step})` : ""}${
            q.craftsman_name ? `, ${q.craftsman_name}` : ""
          }`
      );
      return {
        ok: true,
        summary: lines.length
          ? lines.join(". ")
          : "Nothing on the shop queue in this workspace.",
      };
    }

    if (name === "log_shop_queue_item") {
      const title = argString(args, "title");
      if (!title) return { error: "Need a piece title." };
      const stageRaw = argString(args, "stage") || "design_approved";
      const stage = (SHOP_STAGES as readonly string[]).includes(stageRaw)
        ? stageRaw
        : "design_approved";
      const stepRaw = argString(args, "fab_step");
      const fab_step =
        stepRaw && (SHOP_FAB_STEPS as readonly string[]).includes(stepRaw)
          ? stepRaw
          : null;
      let projectId: string | null = null;
      const projectRef = argString(args, "project_name");
      if (projectRef) {
        const project = await requireOneProject(
          supabase,
          workspace_id,
          projectRef,
          null
        );
        if ("error" in project) return project;
        projectId = project.id;
      }
      const { data, error } = await supabase
        .from("shop_queue")
        .insert({
          workspace_id,
          project_id: projectId,
          title: title.slice(0, 200),
          stage,
          fab_step,
          craftsman_name: argString(args, "craftsman_name"),
          install_on: argString(args, "install_on"),
          access_notes: argString(args, "access_notes"),
        })
        .select("title, stage")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not queue that piece." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Queued ${data.title} as ${data.stage}.`
      );
    }

    if (name === "list_steel_drawings") {
      const { data, error } = await supabase
        .from("steel_drawings")
        .select("title, version, status, pe_status")
        .eq("workspace_id", workspace_id)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (d: {
          title: string;
          version: number;
          status: string;
          pe_status: string;
        }) => `${d.title} v${d.version}: ${d.status}, PE ${d.pe_status}`
      );
      return {
        ok: true,
        summary: lines.length
          ? lines.join(". ")
          : "No steel drawings in this workspace.",
      };
    }

    if (name === "log_steel_drawing") {
      const title = argString(args, "title");
      if (!title) return { error: "Need a drawing title." };
      const stRaw = argString(args, "status") || "draft";
      const status = (STEEL_DRAWING_STATUSES as readonly string[]).includes(
        stRaw
      )
        ? stRaw
        : "draft";
      const peRaw = argString(args, "pe_status") || "not_required";
      const pe_status = (STEEL_PE_STATUSES as readonly string[]).includes(peRaw)
        ? peRaw
        : "not_required";
      let projectId: string | null = null;
      const projectRef = argString(args, "project_name");
      if (projectRef) {
        const project = await requireOneProject(
          supabase,
          workspace_id,
          projectRef,
          null
        );
        if ("error" in project) return project;
        projectId = project.id;
      }
      const { data, error } = await supabase
        .from("steel_drawings")
        .insert({
          workspace_id,
          project_id: projectId,
          title: title.slice(0, 200),
          status,
          pe_status,
          version: Number(args.version) || 1,
          dimensions: argString(args, "dimensions"),
          weld_notes: argString(args, "weld_notes"),
        })
        .select("title, status")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not log that drawing." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged drawing ${data.title} as ${data.status}.`
      );
    }

    if (name === "list_steel_specs") {
      const { data, error } = await supabase
        .from("steel_specs")
        .select("name, metal, finish, quote_valid_until, signed_off_at")
        .eq("workspace_id", workspace_id)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (s: {
          name: string;
          metal: string;
          finish: string;
          quote_valid_until: string | null;
          signed_off_at: string | null;
        }) =>
          `${s.metal} ${s.name} (${s.finish})${
            s.signed_off_at ? " signed off" : " needs sign-off"
          }`
      );
      return {
        ok: true,
        summary: lines.length
          ? lines.join(". ")
          : "No steel specs in this workspace.",
      };
    }

    if (name === "log_steel_spec") {
      const selName = argString(args, "name");
      if (!selName) return { error: "Need a spec name." };
      const metalRaw = argString(args, "metal") || "mild";
      const metal = (STEEL_METALS as readonly string[]).includes(metalRaw)
        ? metalRaw
        : "mild";
      const finRaw = argString(args, "finish") || "raw";
      const finish = (STEEL_FINISHES as readonly string[]).includes(finRaw)
        ? finRaw
        : "raw";
      let projectId: string | null = null;
      const projectRef = argString(args, "project_name");
      if (projectRef) {
        const project = await requireOneProject(
          supabase,
          workspace_id,
          projectRef,
          null
        );
        if ("error" in project) return project;
        projectId = project.id;
      }
      const { data, error } = await supabase
        .from("steel_specs")
        .insert({
          workspace_id,
          project_id: projectId,
          metal,
          finish,
          thickness: argString(args, "thickness"),
          name: selName.slice(0, 200),
          cost: Number(args.cost) || 0,
          quote_valid_until: argString(args, "quote_valid_until"),
          signed_off_at: args.signed_off ? new Date().toISOString() : null,
        })
        .select("name, metal")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not log that spec." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged ${data.metal} spec ${data.name}.`
      );
    }

    if (name === "list_steel_queue") {
      const { data, error } = await supabase
        .from("steel_queue")
        .select("title, stage, fab_step, fabricator_name")
        .eq("workspace_id", workspace_id)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (q: {
          title: string;
          stage: string;
          fab_step: string | null;
          fabricator_name: string | null;
        }) =>
          `${q.title}: ${q.stage}${q.fab_step ? ` (${q.fab_step})` : ""}${
            q.fabricator_name ? `, ${q.fabricator_name}` : ""
          }`
      );
      return {
        ok: true,
        summary: lines.length
          ? lines.join(". ")
          : "Nothing on the fab queue in this workspace.",
      };
    }

    if (name === "log_steel_queue_item") {
      const title = argString(args, "title");
      if (!title) return { error: "Need a piece title." };
      const stageRaw = argString(args, "stage") || "design_approved";
      const stage = (STEEL_STAGES as readonly string[]).includes(stageRaw)
        ? stageRaw
        : "design_approved";
      const stepRaw = argString(args, "fab_step");
      const fab_step =
        stepRaw && (STEEL_FAB_STEPS as readonly string[]).includes(stepRaw)
          ? stepRaw
          : null;
      let projectId: string | null = null;
      const projectRef = argString(args, "project_name");
      if (projectRef) {
        const project = await requireOneProject(
          supabase,
          workspace_id,
          projectRef,
          null
        );
        if ("error" in project) return project;
        projectId = project.id;
      }
      const { data, error } = await supabase
        .from("steel_queue")
        .insert({
          workspace_id,
          project_id: projectId,
          title: title.slice(0, 200),
          stage,
          fab_step,
          fabricator_name: argString(args, "fabricator_name"),
          install_on: argString(args, "install_on"),
          access_notes: argString(args, "access_notes"),
        })
        .select("title, stage")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not queue that piece." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Queued ${data.title} as ${data.stage}.`
      );
    }

    if (name === "list_steel_weld_logs") {
      const { data, error } = await supabase
        .from("steel_weld_logs")
        .select("welder_name, weld_type, result, ndt_result")
        .eq("workspace_id", workspace_id)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (w: {
          welder_name: string;
          weld_type: string;
          result: string;
          ndt_result: string;
        }) =>
          `${w.welder_name} ${w.weld_type}: visual ${w.result}, NDT ${w.ndt_result}`
      );
      return {
        ok: true,
        summary: lines.length
          ? `${lines.join(". ")} Certification numbers are not spoken.`
          : "No weld logs in this workspace.",
      };
    }

    if (name === "log_steel_weld") {
      const welder = argString(args, "welder_name");
      if (!welder) return { error: "Need a welder name." };
      const typeRaw = argString(args, "weld_type") || "mig";
      const weld_type = (WELD_TYPES as readonly string[]).includes(typeRaw)
        ? typeRaw
        : "mig";
      const resRaw = argString(args, "result") || "pending";
      const result = (WELD_RESULTS as readonly string[]).includes(resRaw)
        ? resRaw
        : "pending";
      const ndtRaw = argString(args, "ndt_result") || "none";
      const ndt_result = (NDT_RESULTS as readonly string[]).includes(ndtRaw)
        ? ndtRaw
        : "none";
      let projectId: string | null = null;
      const projectRef = argString(args, "project_name");
      if (projectRef) {
        const project = await requireOneProject(
          supabase,
          workspace_id,
          projectRef,
          null
        );
        if ("error" in project) return project;
        projectId = project.id;
      }
      const { data, error } = await supabase
        .from("steel_weld_logs")
        .insert({
          workspace_id,
          project_id: projectId,
          welder_name: welder.slice(0, 200),
          weld_type,
          joint: argString(args, "joint"),
          result,
          ndt_result,
          notes: argString(args, "notes"),
        })
        .select("welder_name, weld_type")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not log that weld." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged ${data.weld_type} weld for ${data.welder_name}. Do not store cert numbers.`
      );
    }

    if (name === "list_bar_events") {
      const { data, error } = await supabase
        .from("bar_events")
        .select(
          "title, event_on, venue_name, guest_count, deposit_paid, retainer_amount, package_tier, status"
        )
        .eq("workspace_id", workspace_id)
        .order("event_on", { ascending: true })
        .limit(20);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (e: {
          title: string;
          event_on: string | null;
          venue_name: string | null;
          guest_count: number | null;
          deposit_paid: boolean;
          retainer_amount: number;
          package_tier: string;
          status: string;
        }) =>
          `${e.title} ${e.event_on ?? "no date"} at ${e.venue_name ?? "no venue"}, ${e.guest_count ?? "?"} guests, retainer ${e.retainer_amount}, deposit ${e.deposit_paid ? "paid" : "unpaid"}, ${e.package_tier}, ${e.status}`
      );
      return {
        ok: true,
        summary: lines.length
          ? lines.join(". ")
          : "No bartending events in this workspace.",
      };
    }

    if (name === "log_bar_event") {
      const flat = flattenBarEventSpecs(args);
      const title = argString(flat, "title");
      if (!title) return { error: "Need an event name." };
      let contactId: string | null = null;
      const contactRef = argString(flat, "contact_name");
      if (contactRef) {
        const contact = await requireOneContact(
          supabase,
          workspace_id,
          contactRef
        );
        if ("error" in contact) return contact;
        contactId = contact.id;
      }
      const event_type = (BAR_EVENT_TYPES as readonly string[]).includes(
        argString(flat, "event_type") ?? ""
      )
        ? argString(flat, "event_type")
        : "private_party";
      const package_tier = (BAR_PACKAGE_TIERS as readonly string[]).includes(
        argString(flat, "package_tier") ?? ""
      )
        ? argString(flat, "package_tier")
        : "full_open";
      const consult_kind = (BAR_CONSULT_KINDS as readonly string[]).includes(
        argString(flat, "consult_kind") ?? ""
      )
        ? argString(flat, "consult_kind")
        : "call";
      const dates = barEventDateFields(flat);
      const { data, error } = await supabase
        .from("bar_events")
        .insert({
          workspace_id,
          contact_id: contactId,
          title: title.slice(0, 200),
          event_on: dates.event_on,
          event_start_at: dates.event_start_at,
          venue_name: argString(flat, "venue_name"),
          venue_address: argString(flat, "venue_address"),
          guest_count: argNumber(flat, "guest_count"),
          deposit_paid: argBool(flat, "deposit_paid") ?? false,
          retainer_amount: argNumber(flat, "retainer_amount") ?? 0,
          event_type,
          package_tier,
          consult_kind,
          status: (BAR_EVENT_STATUSES as readonly string[]).includes(
            argString(flat, "status") ?? ""
          )
            ? argString(flat, "status")
            : "inquiry",
        })
        .select("title")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not log that event." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged event ${data.title}.`
      );
    }

    if (name === "list_bar_menus") {
      const { data, error } = await supabase
        .from("bar_menus")
        .select("name, package_tier, setup_style, status")
        .eq("workspace_id", workspace_id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (m: {
          name: string;
          package_tier: string;
          setup_style: string;
          status: string;
        }) => `${m.name}: ${m.package_tier}, ${m.setup_style}, ${m.status}`
      );
      return {
        ok: true,
        summary: lines.length ? lines.join(". ") : "No bar menus in this workspace.",
      };
    }

    if (name === "log_bar_menu") {
      const menuName = argString(args, "name");
      if (!menuName) return { error: "Need a menu name." };
      const package_tier = (BAR_PACKAGE_TIERS as readonly string[]).includes(
        argString(args, "package_tier") ?? ""
      )
        ? argString(args, "package_tier")
        : "full_open";
      const setup_style = (BAR_SETUP_STYLES as readonly string[]).includes(
        argString(args, "setup_style") ?? ""
      )
        ? argString(args, "setup_style")
        : "cart";
      const { data, error } = await supabase
        .from("bar_menus")
        .insert({
          workspace_id,
          name: menuName.slice(0, 200),
          package_tier,
          setup_style,
          cocktails: argString(args, "cocktails"),
          dietary_notes: argString(args, "dietary_notes"),
        })
        .select("name")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not log that menu." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged menu ${data.name}.`
      );
    }

    if (name === "list_bar_compliance") {
      const { data, error } = await supabase
        .from("bar_compliance")
        .select("name, kind, status, expires_on")
        .eq("workspace_id", workspace_id)
        .order("expires_on", { ascending: true })
        .limit(20);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (c: {
          name: string;
          kind: string;
          status: string;
          expires_on: string | null;
        }) => `${c.name} ${c.kind} ${c.status}${c.expires_on ? ` until ${c.expires_on}` : ""}`
      );
      return {
        ok: true,
        summary: lines.length
          ? `${lines.join(". ")} License numbers are not spoken.`
          : "No bar compliance records in this workspace.",
      };
    }

    if (name === "log_bar_compliance") {
      const cname = argString(args, "name");
      if (!cname) return { error: "Need a compliance name." };
      const kind = (BAR_COMPLIANCE_KINDS as readonly string[]).includes(
        argString(args, "kind") ?? ""
      )
        ? argString(args, "kind")
        : "liquor_license";
      const status = (BAR_COMPLIANCE_STATUSES as readonly string[]).includes(
        argString(args, "status") ?? ""
      )
        ? argString(args, "status")
        : "needed";
      const { data, error } = await supabase
        .from("bar_compliance")
        .insert({
          workspace_id,
          name: cname.slice(0, 200),
          kind,
          holder_name: argString(args, "holder_name"),
          expires_on: argString(args, "expires_on"),
          status,
        })
        .select("name")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not log that compliance item." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged compliance ${data.name}. Do not store license numbers in chat.`
      );
    }

    if (name === "list_bar_orders") {
      const { data, error } = await supabase
        .from("bar_supply_orders")
        .select("vendor_name, kind, status, pickup_on")
        .eq("workspace_id", workspace_id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (o: {
          vendor_name: string;
          kind: string;
          status: string;
          pickup_on: string | null;
        }) =>
          `${o.vendor_name} ${o.kind} ${o.status}${o.pickup_on ? ` ${o.pickup_on}` : ""}`
      );
      return {
        ok: true,
        summary: lines.length
          ? lines.join(". ")
          : "No bar supply orders in this workspace.",
      };
    }

    if (name === "log_bar_order") {
      const vendor = argString(args, "vendor_name");
      if (!vendor) return { error: "Need a vendor name." };
      const kind = (BAR_ORDER_KINDS as readonly string[]).includes(
        argString(args, "kind") ?? ""
      )
        ? argString(args, "kind")
        : "alcohol";
      const status = (BAR_ORDER_STATUSES as readonly string[]).includes(
        argString(args, "status") ?? ""
      )
        ? argString(args, "status")
        : "needed";
      const { data, error } = await supabase
        .from("bar_supply_orders")
        .insert({
          workspace_id,
          vendor_name: vendor.slice(0, 200),
          kind,
          status,
          pickup_on: argString(args, "pickup_on"),
        })
        .select("vendor_name")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not log that order." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged supply order from ${data.vendor_name}.`
      );
    }

    if (name === "list_bar_crew") {
      const { data, error } = await supabase
        .from("bar_crew")
        .select("name, role, tips_expires_on")
        .eq("workspace_id", workspace_id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (c: { name: string; role: string; tips_expires_on: string | null }) =>
          `${c.name} ${c.role}${c.tips_expires_on ? `, TIPS through ${c.tips_expires_on}` : ""}`
      );
      return {
        ok: true,
        summary: lines.length
          ? `${lines.join(". ")} Certification numbers are not spoken.`
          : "No bar crew in this workspace.",
      };
    }

    if (name === "log_bar_crew") {
      const crewName = argString(args, "name");
      if (!crewName) return { error: "Need a crew name." };
      const role = (BAR_CREW_ROLES as readonly string[]).includes(
        argString(args, "role") ?? ""
      )
        ? argString(args, "role")
        : "bartender";
      const { data, error } = await supabase
        .from("bar_crew")
        .insert({
          workspace_id,
          name: crewName.slice(0, 200),
          role,
          tips_expires_on: argString(args, "tips_expires_on"),
          rating: argNumber(args, "rating"),
        })
        .select("name")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not log that crew member." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged crew member ${data.name}. Do not store cert numbers.`
      );
    }

    if (name === "list_bar_onsite") {
      const { data, error } = await supabase
        .from("bar_onsite")
        .select("title, kind, incident_kind")
        .eq("workspace_id", workspace_id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return { error: error.message };
      const lines = (data ?? []).map(
        (r: { title: string; kind: string; incident_kind: string | null }) =>
          `${r.title} ${r.kind}${r.incident_kind ? ` ${r.incident_kind}` : ""}`
      );
      return {
        ok: true,
        summary: lines.length
          ? lines.join(". ")
          : "No on-site bar notes in this workspace.",
      };
    }

    if (name === "log_bar_onsite") {
      const onsiteTitle = argString(args, "title");
      if (!onsiteTitle) return { error: "Need a title." };
      const kind = (BAR_ONSITE_KINDS as readonly string[]).includes(
        argString(args, "kind") ?? ""
      )
        ? argString(args, "kind")
        : "setup_photo";
      const incident_kind = (BAR_INCIDENT_KINDS as readonly string[]).includes(
        argString(args, "incident_kind") ?? ""
      )
        ? argString(args, "incident_kind")
        : null;
      const { data, error } = await supabase
        .from("bar_onsite")
        .insert({
          workspace_id,
          title: onsiteTitle.slice(0, 200),
          kind,
          incident_kind,
          notes: argString(args, "notes"),
        })
        .select("title")
        .maybeSingle();
      if (error || !data) {
        return { error: error?.message ?? "Could not log that on-site note." };
      }
      return lunaMutationOk(
        supabase,
        workspace_id,
        name,
        `Logged on-site note ${data.title}.`
      );
    }

    return { error: "Unknown tool." };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Tool failed.",
    };
  }
}
