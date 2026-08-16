import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendServerEmail } from "@/lib/email/sendServerEmail";
import { buildTemplateContext } from "@/lib/email/buildTemplateContext";
import { resolveTemplate } from "@/lib/email/smartFields";
import { getAppBaseUrl } from "@/lib/esign/helpers";

// nodemailer (SMTP path) needs the Node runtime.
export const runtime = "nodejs";

interface Attachment {
  filename: string;
  content: string; // base64
}

/**
 * POST /api/emails/compose
 *
 * The template-aware manual send. Resolves smart fields server-side against
 * live project/client data, optionally appends the workspace signature, and
 * either previews (dry_run), sends now, or schedules for later.
 *
 * Body:
 * {
 *   workspace_id, dry_run?, scheduled_for?,           // ISO string → schedule
 *   recipient_email, recipient_name?,
 *   subject, body,                                     // raw, may contain {{tokens}}
 *   template_id?, contact_id?, project_id?,
 *   invoice_id?, contract_id?, form_id?,
 *   attachments?: [{ filename, content(base64) }],     // manual sends only
 *   append_signature?: boolean
 * }
 *
 * Returns: { resolved: {subject, body}, warnings: [...], sent?, scheduled?, error? }
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
  const {
    workspace_id,
    dry_run = false,
    scheduled_for = null,
    recipient_email,
    recipient_name = null,
    subject,
    body: rawBody,
    template_id = null,
    contact_id = null,
    project_id = null,
    invoice_id = null,
    contract_id = null,
    form_id = null,
    attachments = [],
    append_signature = true,
  } = body as {
    workspace_id?: string;
    dry_run?: boolean;
    scheduled_for?: string | null;
    recipient_email?: string;
    recipient_name?: string | null;
    subject?: string;
    body?: string;
    template_id?: string | null;
    contact_id?: string | null;
    project_id?: string | null;
    invoice_id?: string | null;
    contract_id?: string | null;
    form_id?: string | null;
    attachments?: Attachment[];
    append_signature?: boolean;
  };

  if (!workspace_id || subject === undefined || rawBody === undefined) {
    return NextResponse.json(
      { error: "workspace_id, subject and body are required" },
      { status: 400 }
    );
  }
  if (!dry_run && !recipient_email) {
    return NextResponse.json(
      { error: "recipient_email is required to send" },
      { status: 400 }
    );
  }

  // Sending user's display name for {{user.name}}
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const baseUrl = getAppBaseUrl(request);
  const context = await buildTemplateContext({
    workspaceId: workspace_id,
    contactId: contact_id,
    projectId: project_id,
    invoiceId: invoice_id,
    contractId: contract_id,
    formId: form_id,
    baseUrl,
    userName: profile?.full_name ?? null,
  });

  const resolved = resolveTemplate(subject, rawBody, context, {
    missingBehavior: "warn",
  });

  // Optionally append the workspace default signature.
  let finalBody = resolved.body;
  if (append_signature) {
    const { data: settings } = await supabase
      .from("email_settings")
      .select("signature_html")
      .eq("workspace_id", workspace_id)
      .maybeSingle();
    if (settings?.signature_html) {
      finalBody = `${finalBody}<br><br>${settings.signature_html}`;
    }
  }

  // Preview only — never sends.
  if (dry_run) {
    return NextResponse.json({
      resolved: { subject: resolved.subject, body: finalBody },
      warnings: resolved.warnings,
    });
  }

  // Schedule for later.
  if (scheduled_for) {
    const when = new Date(scheduled_for);
    if (isNaN(when.getTime())) {
      return NextResponse.json(
        { error: "Invalid scheduled_for date" },
        { status: 400 }
      );
    }
    const { error: insErr } = await supabase.from("scheduled_emails").insert({
      workspace_id,
      contact_id,
      project_id,
      template_id,
      to_email: recipient_email,
      to_name: recipient_name,
      subject: resolved.subject,
      body_html: finalBody,
      attachments: attachments || [],
      scheduled_for: when.toISOString(),
      status: "scheduled",
      created_by: user.id,
    });
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
    return NextResponse.json({
      scheduled: true,
      scheduled_for: when.toISOString(),
      warnings: resolved.warnings,
    });
  }

  // Send now.
  const result = await sendServerEmail({
    workspaceId: workspace_id,
    to: recipient_email as string,
    toName: recipient_name,
    contactId: contact_id,
    templateId: template_id,
    subject: resolved.subject,
    html: finalBody,
    attachments: (attachments || []).map((a) => ({
      filename: a.filename,
      content: a.content,
    })),
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to send email", warnings: resolved.warnings },
      { status: 500 }
    );
  }

  return NextResponse.json({ sent: true, warnings: resolved.warnings });
}
