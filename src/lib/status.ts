import type {
  ProjectStatus,
  ContractStatus,
  InvoiceStatus,
  EsignDocumentStatus,
} from "@/types/database";

/** Tailwind classes for e-signature document status badges (outline variant). */
export function esignStatusClasses(status: EsignDocumentStatus): string {
  const classes: Record<EsignDocumentStatus, string> = {
    draft: "border-slate-500/40 text-slate-400",
    sent: "border-blue-500/40 text-blue-400",
    viewed: "border-amber-500/40 text-amber-400",
    signed: "border-green-500/40 text-green-400",
    countersigned: "border-emerald-500/40 text-emerald-400",
    void: "border-red-500/40 text-red-400",
  };
  return classes[status] || "";
}

/** Tailwind classes for project status badges (outline variant). */
export const projectStatusClasses: Record<ProjectStatus, string> = {
  planning: "border-slate-500/40 text-slate-400",
  active: "border-green-500/40 text-green-400",
  on_hold: "border-amber-500/40 text-amber-400",
  completed: "border-blue-500/40 text-blue-400",
  cancelled: "border-red-500/40 text-red-400",
};

/** Tailwind classes for contract status badges (outline variant). */
export function contractStatusClasses(status: ContractStatus): string {
  const classes: Record<ContractStatus, string> = {
    draft: "border-slate-500/40 text-slate-400",
    sent: "border-blue-500/40 text-blue-400",
    active: "border-green-500/40 text-green-400",
    completed: "border-purple-500/40 text-purple-400",
    cancelled: "border-red-500/40 text-red-400",
  };
  return classes[status] || "";
}

/** Tailwind classes for invoice status badges (outline variant). */
export function invoiceStatusClasses(status: InvoiceStatus): string {
  const classes: Record<InvoiceStatus, string> = {
    draft: "border-slate-500/40 text-slate-400",
    sent: "border-blue-500/40 text-blue-400",
    paid: "border-green-500/40 text-green-400",
    overdue: "border-red-500/40 text-red-400",
    cancelled: "border-gray-500/40 text-gray-400",
  };
  return classes[status] || "";
}

/** Get Badge variant for status-based badges. */
export function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  // Map common status types to badge variants
  if (status === "sent" || status === "active" || status === "success") {
    return "default";
  }
  if (status === "failed" || status === "overdue" || status === "cancelled") {
    return "destructive";
  }
  if (status === "pending" || status === "draft") {
    return "secondary";
  }
  return "outline";
}
