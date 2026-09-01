import "server-only";

import { sanitizeLunaContext, formatTimeInZone, isIanaTimeZone } from "@/lib/luna";
import { sendServerEmail } from "@/lib/email/sendServerEmail";

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
  if (!nameOrEmail) return null;
  if (nameOrEmail.includes("@")) {
    const { data } = await supabase
      .from("contacts")
      .select("id")
      .eq("workspace_id", workspaceId)
      .ilike("email", nameOrEmail)
      .limit(1)
      .maybeSingle();
    return typeof data?.id === "string" ? data.id : null;
  }
  const { data } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, organization_name")
    .eq("workspace_id", workspaceId)
    .limit(40);
  const needle = nameOrEmail.toLowerCase();
  const match = (data ?? []).find((row: Record<string, unknown>) => {
    const full = [row.first_name, row.last_name].filter(Boolean).join(" ").toLowerCase();
    const org =
      typeof row.organization_name === "string"
        ? row.organization_name.toLowerCase()
        : "";
    return full.includes(needle) || org.includes(needle);
  });
  return typeof match?.id === "string" ? match.id : null;
}

async function findProjectId(
  supabase: LunaSupabaseClient,
  workspaceId: string,
  name: string | null
): Promise<string | null> {
  if (!name) return null;
  const { data } = await supabase
    .from("projects")
    .select("id")
    .eq("workspace_id", workspaceId)
    .ilike("name", name)
    .limit(1)
    .maybeSingle();
  return typeof data?.id === "string" ? data.id : null;
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
    return `- ${num} (${status})`;
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

/** Run weather/forms even if Gemini skips tools or errors out. */
export function inferLunaForcedTools(
  message: string,
  defaults?: { homeCity?: string | null }
): LunaForcedTool[] {
  const m = message.trim();
  const tools: LunaForcedTool[] = [];

  if (/\b(weather|forecast|temperature)\b/i.test(m)) {
    const loc =
      m.match(/\b(?:in|for|at)\s+([A-Za-z][A-Za-z .'-]{1,48}?)(?:[?.!]|$)/i)?.[1] ??
      m.match(/\b(?:weather|forecast|temperature)\s+(?:in\s+|for\s+|at\s+)?(.+)/i)?.[1];
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

  if (
    /\b(create|make|build|new|draft|add)\b.{0,60}\bforms?\b/i.test(m) ||
    /\bforms?\b.{0,40}\b(create|make|build|new|draft)\b/i.test(m) ||
    /\b(contact|intake|lead|sign[- ]?up|client|feedback|survey)\s+form\b/i.test(m)
  ) {
    const named = m.match(
      /\bform\s+(?:called|named|titled|for)\s+["']?([^"'?.!]+)["']?/i
    );
    const kind = m.match(
      /\b(contact|intake|lead|sign[- ]?up|client|feedback|survey)\s+form\b/i
    );
    const name = (
      named?.[1]?.trim() ||
      (kind ? `${kind[1].replace(/-/g, " ")} form` : "Intake form")
    ).slice(0, 80);
    const fieldsHint = m.match(/\bfields?\s*[:\-]\s*(.+)$/i)?.[1];
    const fields =
      fieldsHint?.trim() ||
      (kind && /contact/i.test(kind[1])
        ? "Name, Email, Phone"
        : "Name, Email, Phone, Message");
    tools.push({
      name: "create_form",
      args: { name, fields: fields.slice(0, 200) },
    });
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

    if (name === "create_contact") {
      const firstName = argString(args, "first_name");
      const lastName = argString(args, "last_name");
      const organizationName = argString(args, "organization_name");
      const email = argString(args, "email");
      if (!firstName && !lastName && !organizationName && !email) {
        return { error: "Need a name, organization, or email to create a contact." };
      }
      const typeArg = argString(args, "type");
      const type =
        typeArg === "organization" || typeArg === "lead" || typeArg === "person"
          ? typeArg
          : organizationName && !firstName && !lastName
            ? "organization"
            : "person";

      const { data, error } = await supabase
        .from("contacts")
        .insert({
          workspace_id,
          type,
          first_name: firstName,
          last_name: lastName,
          organization_name: organizationName,
          email,
          phone: argString(args, "phone"),
          tags: [],
        })
        .select("id, first_name, last_name, organization_name, email")
        .maybeSingle();

      if (error || !data) {
        return { error: error?.message ?? "Could not create contact." };
      }
      const label =
        [data.first_name, data.last_name].filter(Boolean).join(" ").trim() ||
        data.organization_name ||
        data.email ||
        "contact";
      return { ok: true, summary: `Created contact ${label}.` };
    }

    if (name === "update_project_status") {
      const status = argString(args, "status");
      if (!status || !PROJECT_STATUSES.has(status)) {
        return {
          error:
            "Status must be planning, active, on_hold, completed, or cancelled.",
        };
      }

      let projectId = argString(args, "project_id");
      const projectName = argString(args, "project_name");
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
      return {
        ok: true,
        summary: `Updated ${data.name ?? "project"} to ${data.status}.`,
      };
    }

    if (name === "create_task") {
      const title = argString(args, "title");
      if (!title) return { error: "A task title is required." };

      const statusArg = argString(args, "status");
      const status =
        statusArg && TASK_STATUSES.has(statusArg) ? statusArg : "todo";
      const priorityArg = argString(args, "priority");
      const priority =
        priorityArg && TASK_PRIORITIES.has(priorityArg) ? priorityArg : "medium";

      let projectId = argString(args, "project_id");
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
          due_date: argString(args, "due_date"),
          position: 0,
          completed_at: status === "done" ? new Date().toISOString() : null,
        })
        .select("id, title, status")
        .maybeSingle();

      if (error || !data) {
        return { error: error?.message ?? "Could not create task." };
      }
      return { ok: true, summary: `Created task ${data.title}.` };
    }

    if (name === "create_form") {
      const formName = argString(args, "name");
      if (!formName) return { error: "A form name is required." };
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
      return { ok: true, summary: `Created draft form ${data.name}.` };
    }

    if (name === "create_contract") {
      const contractName = argString(args, "name");
      if (!contractName) return { error: "A contract name is required." };
      const contactId = await findContactId(
        supabase,
        workspace_id,
        argString(args, "contact_name") ?? argString(args, "contact_email")
      );
      const projectId = await findProjectId(
        supabase,
        workspace_id,
        argString(args, "project_name")
      );
      const value = argNumber(args, "value");
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
      return {
        ok: true,
        summary: `Created draft contract ${data.name} (${data.contract_number}).`,
      };
    }

    if (name === "send_email") {
      let to = argString(args, "to_email");
      const contactRef =
        argString(args, "contact_name") ?? argString(args, "contact_email");
      let contactId: string | null = null;
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
      const result = await sendServerEmail({
        workspaceId: workspace_id,
        to,
        toName: argString(args, "to_name"),
        subject,
        html: `<p>${body.replace(/</g, "&lt;").replace(/\n/g, "<br/>")}</p>`,
        contactId,
      });
      if (!result.success) {
        return { error: result.error ?? "Email failed to send." };
      }
      return { ok: true, summary: `Sent email to ${to} about ${subject}.` };
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
      return {
        ok: true,
        summary: `Created workflow ${data.name} as inactive. Turn it on when you are ready.`,
      };
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
      return {
        ok: true,
        summary: `${data.name} is now ${data.is_active ? "on" : "off"}.`,
      };
    }

    return { error: "Unknown tool." };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Tool failed.",
    };
  }
}
