import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/email/crypto";
import type { EmailSettings } from "@/types/database";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";

/**
 * Strip encrypted secrets before returning settings to the client, and add
 * boolean flags indicating whether a password is on file.
 */
function sanitize(row: Record<string, unknown> | null): (EmailSettings & Record<string, unknown>) | null {
  if (!row) return null;
  const { smtp_password_enc, imap_password_enc, ...rest } = row;
  return {
    ...(rest as unknown as EmailSettings),
    has_smtp_password: !!smtp_password_enc,
    has_imap_password: !!imap_password_enc,
  };
}

/** GET /api/email-settings?workspaceId=... */
export async function GET(request: NextRequest) {
  const access = await verifyWorkspaceAccess(request);
  if (access.errorResponse) return access.errorResponse;

  const { data: settings, error } = await access.supabase
    .from("email_settings")
    .select("*")
    .eq("workspace_id", access.workspaceId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching email settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: sanitize(settings) });
}

/**
 * POST /api/email-settings
 * Create or update email settings. Body may include:
 *  provider, from_email, from_name, reply_to,
 *  smtp_host, smtp_port, smtp_secure, smtp_username, smtp_password,
 *  imap_enabled, imap_host, imap_port, imap_secure, imap_username, imap_password
 * Passwords are optional on update — omit to keep the existing one.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { workspace_id } = body;
  if (!workspace_id) {
    return NextResponse.json({ error: "workspace_id is required" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("email_settings")
    .select("*")
    .eq("workspace_id", workspace_id)
    .maybeSingle();

  // A lightweight save that only updates the signature / scheduler link (used
  // by the Signature settings card) doesn't carry provider fields — skip the
  // provider validation for it as long as settings already exist.
  const isMetaOnlySave =
    body.provider === undefined &&
    body.from_email === undefined &&
    (("signature_html" in body) || ("scheduler_url" in body));

  if (isMetaOnlySave && !existing) {
    return NextResponse.json(
      { error: "Configure your sender settings before saving a signature." },
      { status: 400 }
    );
  }

  const provider = body.provider === "smtp" ? "smtp" : existing?.provider || "resend";

  // Validate depending on provider (skipped for meta-only saves).
  if (!isMetaOnlySave && provider === "resend") {
    if (!body.from_email || !body.from_name) {
      return NextResponse.json(
        { error: "from_email and from_name are required for Resend." },
        { status: 400 }
      );
    }
  }

  if (!isMetaOnlySave && provider === "smtp") {
    const hasPw = body.smtp_password || existing?.smtp_password_enc;
    if (!body.smtp_host || !body.smtp_port || !body.smtp_username || !hasPw) {
      return NextResponse.json(
        {
          error:
            "SMTP requires host, port, username, and a password (password only needed on first save).",
        },
        { status: 400 }
      );
    }
  }

  // A meta-only save touches nothing but signature/scheduler so we don't
  // clobber the provider configuration.
  const payload: Record<string, unknown> = isMetaOnlySave
    ? { workspace_id }
    : {
        workspace_id,
        provider,
        from_email: body.from_email?.trim() || null,
        from_name: body.from_name?.trim() || null,
        reply_to: body.reply_to?.trim() || null,
        smtp_host: body.smtp_host?.trim() || null,
        smtp_port: body.smtp_port ? Number(body.smtp_port) : null,
        smtp_secure: body.smtp_secure ?? true,
        smtp_username: body.smtp_username?.trim() || null,
        imap_enabled: !!body.imap_enabled,
        imap_host: body.imap_host?.trim() || null,
        imap_port: body.imap_port ? Number(body.imap_port) : null,
        imap_secure: body.imap_secure ?? true,
        imap_username: body.imap_username?.trim() || null,
      };

  // Signature + scheduler link are optional and only updated when present in
  // the request (so an SMTP/IMAP-only save doesn't wipe them).
  if ("signature_html" in body) {
    payload.signature_html = body.signature_html?.trim?.() || null;
  }
  if ("scheduler_url" in body) {
    payload.scheduler_url = body.scheduler_url?.trim?.() || null;
  }

  // Only overwrite encrypted passwords when a new plaintext one is provided.
  if (!isMetaOnlySave && body.smtp_password) {
    payload.smtp_password_enc = encryptSecret(body.smtp_password);
  }
  if (!isMetaOnlySave && body.imap_password) {
    payload.imap_password_enc = encryptSecret(body.imap_password);
  }

  let row;
  let error;
  if (existing) {
    ({ data: row, error } = await supabase
      .from("email_settings")
      .update(payload)
      .eq("workspace_id", workspace_id)
      .select()
      .single());
  } else {
    ({ data: row, error } = await supabase
      .from("email_settings")
      .insert(payload)
      .select()
      .single());
  }

  if (error) {
    console.error("Error saving email settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: sanitize(row) }, { status: existing ? 200 : 201 });
}
