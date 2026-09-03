import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  industryDisplayLabel,
  industrySectorLabel,
} from "@/lib/industryVerticals";
import {
  VERTICAL_REGISTRY,
  listVerticalLunaPacks,
} from "@/lib/verticals/registry";

const CRM_SURFACES = [
  "contacts",
  "invoices",
  "tasks",
  "projects",
  "contracts",
  "pipeline",
  "forms",
  "workflows",
] as const;

function envFlag(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Platform-owner inspect. Uses `industry_preset` (and custom label), not
 * `industry_category` / `industry_group` columns. No SQL or RLS dumps.
 */
export async function inspectSystemArchitecture(
  supabase: SupabaseClient,
  component: string
): Promise<Record<string, unknown>> {
  const key = component.trim().toLowerCase().replace(/\s+/g, "_");

  switch (key) {
    case "vertical_registry":
    case "registry": {
      const registered_packs = Object.keys(VERTICAL_REGISTRY);
      const luna_packs = listVerticalLunaPacks();
      return {
        ok: true,
        registered_packs,
        total_packs: registered_packs.length,
        luna_packs: luna_packs.map((p) => p.key),
        summary: registered_packs.length
          ? `Registered packs: ${registered_packs.join(", ")}. Luna tool packs: ${luna_packs.map((p) => p.name).join(", ") || "none"}.`
          : "No vertical packs are registered.",
      };
    }

    case "database_schema":
    case "schema":
      return {
        ok: true,
        crm_surfaces: [...CRM_SURFACES],
        summary:
          "Shared CRM surfaces are contacts, invoices, tasks, projects, contracts, pipeline, forms, and workflows. Vertical packs add their own ops screens. SQL, columns, and RLS are not available through Luna.",
      };

    case "active_workspaces":
    case "workspaces": {
      const { data, count, error } = await supabase
        .from("workspaces")
        .select("id, name, industry_preset, industry_custom_label, created_at", {
          count: "exact",
        })
        .order("name", { ascending: true })
        .limit(80);
      if (error) return { error: "Could not list workspaces." };
      const workspaces = (data ?? []).map(
        (w: {
          id?: string;
          name?: string | null;
          industry_preset?: string | null;
          industry_custom_label?: string | null;
          created_at?: string | null;
        }) => {
          const name =
            typeof w.name === "string" && w.name.trim()
              ? w.name.trim()
              : "Untitled";
          return {
            id: typeof w.id === "string" ? w.id : "",
            name,
            industry_preset:
              typeof w.industry_preset === "string" ? w.industry_preset : null,
            industry: industryDisplayLabel(
              w.industry_preset,
              w.industry_custom_label
            ),
            industry_group: industrySectorLabel(w.industry_preset),
            created_at:
              typeof w.created_at === "string" ? w.created_at : null,
          };
        }
      );
      const names = workspaces.map((w) => w.name).slice(0, 12).join(", ");
      const total = count ?? workspaces.length;
      return {
        ok: true,
        total_workspaces: total,
        workspaces,
        summary: total
          ? `${total} workspace${total === 1 ? "" : "s"}${names ? `: ${names}` : ""}.`
          : "No workspaces yet.",
      };
    }

    case "system_telemetry":
    case "telemetry":
    case "health": {
      const gemini = envFlag("GEMINI_API_KEY") || envFlag("GOOGLE_API_KEY");
      const [contacts, tasks, invoices] = await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("id", { count: "exact", head: true }),
        supabase.from("invoices").select("id", { count: "exact", head: true }),
      ]);
      const total_contacts = contacts.count ?? 0;
      const total_tasks = tasks.count ?? 0;
      const total_invoices = invoices.count ?? 0;
      const engine_status = gemini ? "Operational" : "Degraded";
      return {
        ok: true,
        total_contacts,
        total_tasks,
        total_invoices,
        engine_status,
        integrations: {
          gemini,
          simli: envFlag("SIMLI_API_KEY"),
          elevenlabs: envFlag("ELEVENLABS_API_KEY"),
          stripe: envFlag("STRIPE_SECRET_KEY"),
          resend: envFlag("RESEND_API_KEY"),
        },
        summary: `${engine_status}. ${total_contacts} contacts, ${total_tasks} tasks, ${total_invoices} invoices across the hub. Gemini ${gemini ? "is" : "is not"} configured.`,
      };
    }

    default:
      return {
        error:
          "Choose vertical_registry, database_schema, active_workspaces, or system_telemetry.",
      };
  }
}
