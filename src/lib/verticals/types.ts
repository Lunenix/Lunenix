import type { IndustrySectorId } from "@/lib/industryVerticals";

/** Sidebar extra link. `icon` is a lucide-react export name (resolved in the client). */
export type VerticalNavItem = {
  href: string;
  label: string;
  icon: string;
};

/**
 * Client-safe pack metadata. Workflows and Luna tools live under
 * `src/lib/verticals/<id>/` and must not be imported from this module.
 */
export type VerticalPack = {
  id: string;
  /** `workspaces.industry_preset` slugs (after `resolveIndustryPreset`). */
  presets: readonly string[];
  /** If `presets` is empty, match every vertical in this sector. */
  sector?: IndustrySectorId;
  /** Workflow name prefix, e.g. `Bar:`. Omit when prefixes stay per-preset in catalog. */
  workflowPrefix?: string;
  nav: readonly VerticalNavItem[];
  /** Hide `/projects` when the pack uses jobs/events instead. */
  hideProjectsNav?: boolean;
};

/**
 * Server-only handler in `src/lib/verticals/<id>/luna.ts`.
 * Return `null` if the tool name is not this pack's. Do not import from client files.
 */
export type VerticalLunaToolFn = (
  workspaceId: string,
  toolName: string,
  args: Record<string, unknown>
) => Promise<Record<string, unknown> | null>;

/** Pack tool result. Summaries only — no row dumps or IDs unless asked. */
export type VerticalExecutionResult =
  | { ok: true; summary: string }
  | { error: string };
