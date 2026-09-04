import { NextResponse } from "next/server";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import {
  PHOTO_EDIT_STATUS_LABELS,
  PHOTO_SHOOT_STATUS_LABELS,
  PHOTO_SHOOT_TYPE_LABELS,
  type PhotoEditStatus,
  type PhotoShootStatus,
  type PhotoShootType,
} from "@/lib/photoService";
import { contactDisplayName } from "@/types/database";

type ContactJoin = {
  type: "person" | "organization" | "lead";
  first_name: string | null;
  last_name: string | null;
  organization_name: string | null;
  email: string | null;
};

function clientLabel(
  title: string,
  contact: ContactJoin | ContactJoin[] | null
): string {
  const row = Array.isArray(contact) ? contact[0] : contact;
  if (row) return contactDisplayName(row);
  return title;
}

function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
  } catch {
    return null;
  }
  return null;
}

function latestMatch<T extends { title: string }>(
  rows: T[],
  needles: string[]
): T | null {
  const lowered = needles.map((n) => n.toLowerCase()).filter(Boolean);
  if (!lowered.length) return null;
  return (
    rows.find((row) => {
      const t = row.title.toLowerCase();
      return lowered.some((n) => t.includes(n) || n.includes(t));
    }) ?? null
  );
}

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const { supabase, workspaceId } = auth;

  const [shoots, shots, edits, galleries, gear, invoices, permits, releases] =
    await Promise.all([
    supabase
      .from("photo_shoots")
      .select(
        "id, title, status, shoot_type, hours, contacts(type, first_name, last_name, organization_name, email)"
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    supabase
      .from("photo_shots")
      .select("id, title, status")
      .eq("workspace_id", workspaceId),
    supabase
      .from("photo_edits")
      .select("id, title, status, due_on")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    supabase
      .from("photo_galleries")
      .select("id, title, status, gallery_url")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    supabase
      .from("photo_gear")
      .select("id, title, qty, reorder_below")
      .eq("workspace_id", workspaceId),
    supabase
      .from("invoices")
      .select("id, status, total, invoice_number")
      .eq("workspace_id", workspaceId),
    supabase
      .from("photo_permits")
      .select("id, title, status")
      .eq("workspace_id", workspaceId),
    supabase
      .from("photo_releases")
      .select("id")
      .eq("workspace_id", workspaceId),
  ]);

  const shootRows = shoots.data ?? [];
  const shotRows = shots.data ?? [];
  const editRows = edits.data ?? [];
  const galleryRows = galleries.data ?? [];
  const gearRows = gear.data ?? [];
  const inv = invoices.data ?? [];
  const permitRows = permits.data ?? [];
  const releaseRows = releases.data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const overdue = inv.filter((i: { status: string }) => i.status === "overdue");
  const sent = inv.filter((i: { status: string }) => i.status === "sent");

  const pipeline = shootRows
    .filter((s: { status: string }) =>
      ["booked", "shooting", "wrapped", "editing"].includes(s.status)
    )
    .map(
      (s: {
        id: string;
        title: string;
        status: string;
        shoot_type: string;
        hours: number | null;
        contacts: ContactJoin | ContactJoin[] | null;
      }) => {
        const client = clientLabel(s.title, s.contacts);
        const edit = latestMatch(editRows, [client, s.title]);
        const gallery = latestMatch(galleryRows, [client, s.title]);
        const typeKey = s.shoot_type as PhotoShootType;
        const statusKey = s.status as PhotoShootStatus;
        const editKey = (edit?.status ?? null) as PhotoEditStatus | null;
        return {
          id: s.id,
          client,
          title: s.title,
          session_type: PHOTO_SHOOT_TYPE_LABELS[typeKey] ?? s.shoot_type,
          coverage_hours: s.hours,
          shoot_status: PHOTO_SHOOT_STATUS_LABELS[statusKey] ?? s.status,
          editing_stage: editKey
            ? PHOTO_EDIT_STATUS_LABELS[editKey]
            : s.status === "editing"
              ? "Editing"
              : "Not in queue yet",
          gallery_url: safeHttpUrl(
            (gallery as { gallery_url?: string | null } | null)?.gallery_url
          ),
        };
      }
    );

  return NextResponse.json({
    shoots: {
      delivered: shootRows.filter((s: { status: string }) => s.status === "delivered")
        .length,
      open: shootRows.filter((s: { status: string }) =>
        ["inquiry", "booked", "shooting", "wrapped", "editing"].includes(s.status)
      ).length,
    },
    production: {
      planned_shots: shotRows.filter((s: { status: string }) => s.status === "planned")
        .length,
      queued_edits: editRows.filter((s: { status: string }) =>
        ["culling", "editing", "grading"].includes(s.status)
      ).length,
    },
    money: {
      overdue_invoices: overdue.length,
      open_invoices: sent.length,
    },
    pipeline,
    alerts: [
      ...overdue.map((i: { invoice_number?: string }) => ({
        kind: "invoice",
        label: `Overdue invoice ${i.invoice_number ?? ""}`.trim(),
        href: "/invoices",
      })),
      ...editRows
        .filter(
          (e: { status: string; due_on?: string | null; title: string }) =>
            e.status !== "delivered" && e.due_on && e.due_on < today
        )
        .map((e: { title: string }) => ({
          kind: "edit",
          label: `Turnaround behind: ${e.title}`,
          href: "/edits",
        })),
      ...editRows
        .filter((e: { status: string }) => e.status === "culling")
        .map((e: { title: string }) => ({
          kind: "cull",
          label: `Culling: ${e.title}`,
          href: "/edits",
        })),
      ...galleryRows
        .filter((g: { status: string }) => g.status === "draft")
        .map((g: { title: string }) => ({
          kind: "gallery",
          label: `Gallery not delivered: ${g.title}`,
          href: "/galleries",
        })),
      ...galleryRows
        .filter((g: { status: string }) => g.status === "expired")
        .map((g: { title: string }) => ({
          kind: "gallery",
          label: `Gallery expired: ${g.title}`,
          href: "/galleries",
        })),
      ...permitRows
        .filter((p: { status: string }) => p.status === "needed")
        .map((p: { title: string }) => ({
          kind: "permit",
          label: `Permit needed: ${p.title}`,
          href: "/photo-permits",
        })),
      ...(releaseRows.length === 0 &&
      shootRows.some((s: { status: string }) => s.status === "booked")
        ? [
            {
              kind: "release",
              label: "Booked shoot with no usage release on file",
              href: "/releases",
            },
          ]
        : []),
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
