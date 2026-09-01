import { NextRequest, NextResponse } from "next/server";
import type { KnowledgeBaseEntry } from "@/types/database";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";

/**
 * GET /api/knowledge-base?workspaceId=...&category=general
 */
export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const rawLimit = Number(searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(rawLimit)
    ? Math.min(50, Math.max(1, Math.floor(rawLimit)))
    : 20;

  let query = auth.supabase
    .from("knowledge_base")
    .select("id, workspace_id, title, content, category, created_at")
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (category && category.trim()) {
    query = query.eq("category", category.trim().slice(0, 40));
  }

  const { data: entries, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    entries: (entries as KnowledgeBaseEntry[]) ?? [],
  });
}

/**
 * POST /api/knowledge-base
 * Body: { workspace_id, title, content, category? }
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

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const category =
    typeof body.category === "string" && body.category.trim()
      ? body.category.trim().slice(0, 40)
      : "general";

  if (!title || !content) {
    return NextResponse.json(
      { error: "title and content are required." },
      { status: 400 }
    );
  }

  const { data: entry, error } = await auth.supabase
    .from("knowledge_base")
    .insert({
      workspace_id: auth.workspaceId,
      title: title.slice(0, 200),
      content: content.slice(0, 20000),
      category,
    })
    .select("id, workspace_id, title, content, category, created_at")
    .maybeSingle();

  if (error || !entry) {
    return NextResponse.json(
      { error: error?.message ?? "Could not save knowledge entry." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { entry: entry as KnowledgeBaseEntry },
    { status: 201 }
  );
}
