import type { FunctionDeclaration } from "@google/genai";

/**
 * Platform-owner Luna tools. Chat is already super-admin gated.
 * Inspect returns pack/workspace summaries, never SQL, RLS, or secrets.
 */
export const SUPER_ADMIN_TOOLS: FunctionDeclaration[] = [
  {
    name: "admin_inspect_system_architecture",
    description:
      "Platform owner only. Summarize installed vertical packs, CRM surfaces, tenant workspace names, or coarse health counts. Never returns SQL, RLS, column lists, API keys, or tokens.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        target_component: {
          type: "string",
          description:
            "vertical_registry, database_schema (module names only), active_workspaces, or system_telemetry",
        },
      },
      required: ["target_component"],
    },
  },
  {
    name: "admin_provision_workspace",
    description:
      "Platform owner only. Create a tenant workspace, set industry_preset from the catalog, seed pipeline and workflows, and add the owner plus platform admins. Use a catalog slug or label such as HVAC or Mobile Bartending, not a free-form industry table.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        workspace_name: { type: "string", description: "Name of the new workspace" },
        owner_email: {
          type: "string",
          description: "Primary administrator email. Must already have a Lunenix account.",
        },
        industry_category: {
          type: "string",
          description:
            "Vertical pack key or catalog label, e.g. mobile_bartending, HVAC, Mobile Bartending",
        },
        industry_group: {
          type: "string",
          description: "Optional sector label such as Home & Field Services",
        },
        phone: { type: "string", description: "Company phone if known" },
        team_size: {
          type: "string",
          description: "Optional 1-5, 6-20, 21-50, 51-200, or 200+",
        },
        industry_custom_label: {
          type: "string",
          description: "Required when the preset is Other",
        },
      },
      required: ["workspace_name", "owner_email", "industry_category"],
    },
  },
  {
    name: "admin_execute_cross_workspace_action",
    description:
      "Platform owner only. Join the named workspace via membership grant, then run a scoped CRM or AI-settings action there. Does not bypass workspace_id. Payload is the same fields as the matching Luna CRM tool.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        target_workspace_id: {
          type: "string",
          description: "Target workspace UUID",
        },
        action_type: {
          type: "string",
          description:
            "manage_contact, update_invoice, reassign_task, or set_ai_settings",
        },
        payload: {
          type: "object",
          description:
            "For manage_contact: create or update contact fields (name, email, notes). For update_invoice: invoice_number, total, status. For reassign_task: title and contact_name. For set_ai_settings: home_city, timezone, custom_instructions.",
        },
      },
      required: ["target_workspace_id", "action_type", "payload"],
    },
  },
];

export const SUPER_ADMIN_TOOL_NAMES = new Set(
  SUPER_ADMIN_TOOLS.map((t) => t.name)
);
