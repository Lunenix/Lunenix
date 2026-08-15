import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/workspaces
 * Creates a workspace and adds the current user as owner.
 * Body: { name, slug? }
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const name: string = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const slug: string =
    (body.slug ?? "")
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  // Ensure slug uniqueness with a short random suffix if needed.
  const uniqueSlug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  const { data: workspace, error: wErr } = await supabase
    .from("workspaces")
    .insert({ name, slug: uniqueSlug })
    .select("*")
    .single();

  if (wErr) {
    return NextResponse.json({ error: wErr.message }, { status: 500 });
  }

  const { error: mErr } = await supabase.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: "owner",
  });

  if (mErr) {
    return NextResponse.json({ error: mErr.message }, { status: 500 });
  }

  return NextResponse.json({ workspace }, { status: 201 });
}
