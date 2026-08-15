import type { ProjectStatus } from "@/types/database";

/** Tailwind classes for project status badges (outline variant). */
export const projectStatusClasses: Record<ProjectStatus, string> = {
  planning: "border-slate-500/40 text-slate-400",
  active: "border-green-500/40 text-green-400",
  on_hold: "border-amber-500/40 text-amber-400",
  completed: "border-blue-500/40 text-blue-400",
  cancelled: "border-red-500/40 text-red-400",
};
