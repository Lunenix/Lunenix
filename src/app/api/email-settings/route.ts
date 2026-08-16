import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/email/crypto";
import type { EmailSettings } from "@/types/database";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const { data: settings, error } = await supabase
    .from("email_settings")
    .select("*")
    .eq("workspace_id", workspaceId)
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

  const provider = body.provider === "smtp" ? "smtp" : "resend";

  // Validate depending on provider.
  if (provider === "resend") {
    if (!body.from_email || !body.from_name) {
      return NextResponse.json(
        { error: "from_email and from_name are required for Resend." },
        { status: 400 }
      );
    }
  }

  const { data: existing } = await supabase
    .from("email_settings")
    .select("*")
    .eq("workspace_id", workspace_id)
    .maybeSingle();

  if (provider === "smtp") {
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

  const payload: Record<string, unknown> = {
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

  // Only overwrite encrypted passwords when a new plaintext one is provided.
  if (body.smtp_password) {
    payload.smtp_password_enc = encryptSecret(body.smtp_password);
  }
  if (body.imap_password) {
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
