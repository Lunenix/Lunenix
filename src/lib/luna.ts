/**
 * Shared metadata + helpers for the Luna AI assistant.
 * Used by both the command center and the settings modal.
 */

/** Permanent CDN URL of the generated photorealistic Luna portrait. */
export const LUNA_AVATAR_URL =
  "https://cdn.abacus.ai/images/11332739-7e5e-427d-b7fb-4dcee2db35c4.png";

export interface VoiceOption {
  id: string;
  label: string;
}

export const VOICE_OPTIONS: VoiceOption[] = [
  { id: "ava", label: "Ava (Confident)" },
  { id: "liam", label: "Liam (Professional)" },
  { id: "nova", label: "Nova (Warm)" },
  { id: "aria", label: "Aria (Energetic)" },
];

export function voiceById(id: string | null | undefined): VoiceOption {
  return VOICE_OPTIONS.find((v) => v.id === id) ?? VOICE_OPTIONS[0];
}

/** Voice-name fragments (lowercase) that identify a female system voice. */
const FEMALE_VOICE_HINTS = [
  "samantha",
  "karen",
  "victoria",
  "susan",
  "hazel",
  "serena",
  "moira",
  "fiona",
  "tessa",
  "veena",
  "zira",
  "aria",
  "jenny",
  "michelle",
  "sonia",
  "libby",
  "google us english", // Chrome's default US voice is female
  "google uk english female",
  "microsoft zira",
  "female",
  "woman",
];

/** Voice-name fragments that identify a male voice (used to avoid them). */
const MALE_VOICE_HINTS = [
  "male",
  "man",
  "daniel",
  "alex",
  "fred",
  "david",
  "mark",
  "george",
  "james",
  "oliver",
  "thomas",
  "guy",
  "eric",
  "google uk english male",
  "microsoft david",
];

/**
 * Some browsers (notably Chrome) populate the voice list asynchronously, so
 * the first `getVoices()` call often returns an empty array — which is exactly
 * why the assistant sometimes fell back to the default (often male) voice.
 * This resolves once voices are actually available.
 */
export function ensureVoicesLoaded(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve([]);
      return;
    }
    const synth = window.speechSynthesis;
    const existing = synth.getVoices();
    if (existing.length) {
      resolve(existing);
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(synth.getVoices());
    };
    synth.addEventListener("voiceschanged", finish, { once: true });
    // Fallback in case the event never fires.
    setTimeout(finish, 1000);
  });
}

/**
 * Pick the best available female voice. Prefers an English female voice, then
 * any female voice, then any non-male English voice, and finally any voice.
 */
const SENSITIVE_FIELD =
  /^(password|passwd|token|secret|hash|api_?key|service_role|authorization|credit_?card|card_?number|cvv|ssn|access_token|refresh_token)/i;

/**
 * Strip secrets and non-operational fields before any CRM row is added to
 * Luna's LLM context. Keeps titles, names, statuses, and similar prompt data.
 */
export function sanitizeLunaContext(
  row: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (SENSITIVE_FIELD.test(key)) continue;
    if (value == null) continue;
    if (typeof value === "string") {
      out[key] = value.length > 400 ? value.slice(0, 400) : value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Minimal query client so this module stays client-safe (no server import).
 * Callers pass the authenticated Supabase server client from API routes.
 */
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

/**
 * Confirm the caller belongs to the workspace before any CRM read/write.
 * Both workspace_id and user_id are required on this membership query.
 */
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

/**
 * Load operational CRM rows for Luna's prompt. Every query is scoped to the
 * membership-verified workspace_id; membership itself is filtered by user_id.
 */
export async function getLunaWorkspaceContext(
  supabase: LunaSupabaseClient,
  workspaceId: string,
  userId: string
): Promise<LunaWorkspaceContext> {
  const empty: LunaWorkspaceContext = {
    contacts: [],
    projects: [],
    tasks: [],
  };
  const member = await assertLunaWorkspaceMember(supabase, workspaceId, userId);
  if (!member) return empty;

  const { workspace_id } = member;

  const [{ data: contacts }, { data: projects }, { data: tasks }] =
    await Promise.all([
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
    ]);

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
  };
}

/** Compact, speakable CRM snapshot for Gemini system instructions. */
export function formatLunaContextForPrompt(ctx: LunaWorkspaceContext): string {
  const contactLines = ctx.contacts.map((c) => {
    const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
    const label =
      name ||
      (typeof c.organization_name === "string" ? c.organization_name : "") ||
      (typeof c.email === "string" ? c.email : "Unnamed contact");
    const email = typeof c.email === "string" ? ` ${c.email}` : "";
    return `- ${label}${email}`;
  });
  const projectLines = ctx.projects.map((p) => {
    const name = typeof p.name === "string" ? p.name : "Untitled project";
    const status = typeof p.status === "string" ? p.status : "unknown";
    const id = typeof p.id === "string" ? p.id : "";
    return `- ${name} (${status}) id ${id}`;
  });
  const taskLines = ctx.tasks.map((t) => {
    const title = typeof t.title === "string" ? t.title : "Untitled task";
    const status = typeof t.status === "string" ? t.status : "todo";
    return `- ${title} (${status})`;
  });

  return [
    "Current workspace snapshot (this workspace only):",
    contactLines.length ? `Contacts:\n${contactLines.join("\n")}` : "Contacts: none",
    projectLines.length ? `Projects:\n${projectLines.join("\n")}` : "Projects: none",
    taskLines.length ? `Tasks:\n${taskLines.join("\n")}` : "Tasks: none",
  ].join("\n");
}

export type LunaToolResult = Record<string, unknown>;

/**
 * Run a Luna CRM tool against the caller's workspace only.
 * Tool arguments never choose workspace_id; it comes from verified membership.
 */
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
      if (!projectId && projectName) {
        const { data: found } = await supabase
          .from("projects")
          .select("id, name")
          .eq("workspace_id", workspace_id)
          .ilike("name", projectName)
          .limit(1)
          .maybeSingle();
        if (found && typeof found.id === "string") projectId = found.id;
      }
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
      const projectName = argString(args, "project_name");
      if (!projectId && projectName) {
        const { data: found } = await supabase
          .from("projects")
          .select("id")
          .eq("workspace_id", workspace_id)
          .ilike("name", projectName)
          .limit(1)
          .maybeSingle();
        if (found && typeof found.id === "string") projectId = found.id;
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

    return { error: "Unknown tool." };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Tool failed.",
    };
  }
}

export function pickFemaleVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;

  const isMale = (name: string) =>
    MALE_VOICE_HINTS.some((h) => name.includes(h));
  const isFemale = (name: string) =>
    FEMALE_VOICE_HINTS.some((h) => name.includes(h));

  // 1. English female voice by explicit hint.
  const englishFemale = voices.find(
    (v) => v.lang.toLowerCase().startsWith("en") && isFemale(v.name.toLowerCase())
  );
  if (englishFemale) return englishFemale;

  // 2. Any female voice by explicit hint.
  const anyFemale = voices.find((v) => isFemale(v.name.toLowerCase()));
  if (anyFemale) return anyFemale;

  // 3. English voice that is not obviously male.
  const englishNonMale = voices.find(
    (v) => v.lang.toLowerCase().startsWith("en") && !isMale(v.name.toLowerCase())
  );
  if (englishNonMale) return englishNonMale;

  // 4. Any voice that is not obviously male.
  const nonMale = voices.find((v) => !isMale(v.name.toLowerCase()));
  return nonMale ?? voices[0];
}
