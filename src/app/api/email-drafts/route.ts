import { NextRequest, NextResponse } from "next/server";
import type { EmailDraft, EmailDraftStatus } from "@/types/database";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";

const DRAFT_STATUSES = new Set<EmailDraftStatus>([
  "draft",
  "scheduled",
  "sent",
  "failed",
  "archived",
]);

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * GET /api/email-drafts?workspaceId=...&status=draft
 */
export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const rawLimit = Number(searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(rawLimit)
    ? Math.min(50, Math.max(1, Math.floor(rawLimit)))
    : 20;

  let query = auth.supabase
    .from("email_drafts")
    .select(
      "id, workspace_id, recipient_email, subject, body_text, status, scheduled_at, created_at"
    )
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status && DRAFT_STATUSES.has(status as EmailDraftStatus)) {
    query = query.eq("status", status);
  }

  const { data: drafts, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ drafts: (drafts as EmailDraft[]) ?? [] });
}

/**
 * POST /api/email-drafts
 * Body: { workspace_id, recipient_email, subject, body_text }
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const auth = await requireWorkspaceMember(
    typeof body.workspace_id === "string" ? body.workspace_id : null
  );
  if ("error" in auth) return auth.error;

  const recipient_email =
    typeof body.recipient_email === "string" ? body.recipient_email.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const body_text = typeof body.body_text === "string" ? body.body_text.trim() : "";

  if (!looksLikeEmail(recipient_email) || !subject || !body_text) {
    return NextResponse.json(
      { error: "recipient_email, subject, and body_text are required." },
      { status: 400 }
    );
  }

  const { data: draft, error } = await auth.supabase
    .from("email_drafts")
    .insert({
      workspace_id: auth.workspaceId,
      recipient_email,
      subject: subject.slice(0, 500),
      body_text: body_text.slice(0, 20000),
      status: "draft",
    })
    .select(
      "id, workspace_id, recipient_email, subject, body_text, status, scheduled_at, created_at"
    )
    .maybeSingle();

  if (error || !draft) {
    return NextResponse.json(
      { error: error?.message ?? "Could not save draft." },
      { status: 500 }
    );
  }

  return NextResponse.json({ draft: draft as EmailDraft }, { status: 201 });
}
