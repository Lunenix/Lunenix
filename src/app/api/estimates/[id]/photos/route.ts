import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";
import { createAdminClient } from "@/lib/supabase/server";
import { ESTIMATE_PHOTO_KINDS } from "@/lib/fieldService";

const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("estimates", params.id);
  if ("error" in authed) return authed.error;

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Photo file is required" }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Photo must be 8 MB or smaller" }, { status: 400 });
  }
  const ext = TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Use PNG, JPG, WebP, or GIF" }, { status: 400 });
  }

  const admin = createAdminClient();
  const path = `${authed.workspaceId}/estimates/${authed.recordId}/${Date.now()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage
    .from("workspace-assets")
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }
  const { data: publicUrl } = admin.storage
    .from("workspace-assets")
    .getPublicUrl(path);

  const caption = String(form.get("caption") ?? "").trim() || null;
  const rawKind = String(form.get("kind") ?? "photo");
  const kind = (ESTIMATE_PHOTO_KINDS as readonly string[]).includes(rawKind)
    ? rawKind
    : "photo";
  const { data, error } = await authed.supabase
    .from("estimate_photos")
    .insert({
      workspace_id: authed.workspaceId,
      estimate_id: authed.recordId,
      file_url: publicUrl.publicUrl,
      caption,
      kind,
    })
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ photo: data }, { status: 201 });
}
