import { NextResponse } from "next/server";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const { supabase, workspaceId } = auth;

  const [shoots, shots, edits, galleries, gear, invoices] = await Promise.all([
    supabase
      .from("photo_shoots")
      .select("id, title, status")
      .eq("workspace_id", workspaceId),
    supabase
      .from("photo_shots")
      .select("id, title, status")
      .eq("workspace_id", workspaceId),
    supabase
      .from("photo_edits")
      .select("id, title, status")
      .eq("workspace_id", workspaceId),
    supabase
      .from("photo_galleries")
      .select("id, title, status")
      .eq("workspace_id", workspaceId),
    supabase
      .from("photo_gear")
      .select("id, title, qty, reorder_below")
      .eq("workspace_id", workspaceId),
    supabase
      .from("invoices")
      .select("id, status, total, invoice_number")
      .eq("workspace_id", workspaceId),
  ]);

  const shootRows = shoots.data ?? [];
  const shotRows = shots.data ?? [];
  const editRows = edits.data ?? [];
  const galleryRows = galleries.data ?? [];
  const gearRows = gear.data ?? [];
  const inv = invoices.data ?? [];
  const overdue = inv.filter((i: { status: string }) => i.status === "overdue");
  const sent = inv.filter((i: { status: string }) => i.status === "sent");

  return NextResponse.json({
    shoots: {
      delivered: shootRows.filter((s: { status: string }) => s.status === "delivered")
        .length,
      open: shootRows.filter((s: { status: string }) =>
        ["inquiry", "booked", "shooting", "editing"].includes(s.status)
      ).length,
    },
    production: {
      planned_shots: shotRows.filter((s: { status: string }) => s.status === "planned")
        .length,
      queued_edits: editRows.filter((s: { status: string }) => s.status === "queued")
        .length,
    },
    money: {
      overdue_invoices: overdue.length,
      open_invoices: sent.length,
    },
    alerts: [
      ...overdue.map((i: { invoice_number?: string }) => ({
        kind: "invoice",
        label: `Overdue invoice ${i.invoice_number ?? ""}`.trim(),
        href: "/invoices",
      })),
      ...editRows
        .filter((e: { status: string }) => e.status === "queued")
        .map((e: { title: string }) => ({
          kind: "edit",
          label: `Edit queued: ${e.title}`,
          href: "/edits",
        })),
      ...galleryRows
        .filter((g: { status: string }) => g.status === "expired")
        .map((g: { title: string }) => ({
          kind: "gallery",
          label: `Gallery expired: ${g.title}`,
          href: "/galleries",
        })),
      ...gearRows
        .filter((e: { qty: number | null; reorder_below: number | null }) => {
          if (e.qty == null || e.reorder_below == null) return false;
          return e.qty <= e.reorder_below;
        })
        .map((e: { title: string }) => ({
          kind: "stock",
          label: `Low gear: ${e.title}`,
          href: "/photo-gear",
        })),
    ],
  });
}
