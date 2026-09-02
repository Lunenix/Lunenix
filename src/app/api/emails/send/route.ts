import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/supabase/workspaceAccess";
import type { EmailLog } from "@/types/database";
import { Resend } from "resend";

// Default "from" address and name (used when workspace has no email settings)
const DEFAULT_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
const DEFAULT_FROM_NAME = "Lunenix";

/**
 * POST /api/emails/send
 * Send an email (single or bulk) via Resend and log it
 * 
 * Uses workspace-specific email settings (from_email, from_name, reply_to) if configured,
 * otherwise falls back to platform defaults.
 * 
 * Body options:
 * - Single: { workspace_id, contact_id?, template_id?, recipient_email, recipient_name?, subject, body }
 * - Bulk: { workspace_id, emails: [{ contact_id?, recipient_email, recipient_name?, subject, body }] }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { workspace_id, emails } = body;

  const authed = await requireWorkspaceMember(workspace_id);
  if ("error" in authed) return authed.error;
  const { supabase, user, workspaceId } = authed;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Email is not configured: RESEND_API_KEY is missing." },
      { status: 503 }
    );
  }
  const resend = new Resend(apiKey);

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspace_id is required" },
      { status: 400 }
    );
  }

  const { data: settings } = await supabase
    .from("email_settings")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  // Use workspace settings if configured, otherwise use platform defaults
  const fromEmail = settings?.from_email || DEFAULT_FROM_EMAIL;
  const fromName = settings?.from_name || DEFAULT_FROM_NAME;
  const from = `${fromName} <${fromEmail}>`;
  const replyTo = settings?.reply_to || undefined;

  // Handle bulk email sending
  if (emails && Array.isArray(emails)) {
    const results = await Promise.allSettled(
      emails.map(async (email) => {
        try {
          // Send via Resend using workspace email settings
          await resend.emails.send({
            from,
            to: email.recipient_email,
            subject: email.subject,
            html: email.body,
            replyTo: replyTo,
          });

          // Log success
          const { data: log } = await supabase
            .from("email_logs")
            .insert({
              workspace_id: workspaceId,
              contact_id: email.contact_id || null,
              template_id: email.template_id || null,
              recipient_email: email.recipient_email,
              recipient_name: email.recipient_name || null,
              subject: email.subject,
              body: email.body,
              status: "sent",
              sent_by: user.id,
            })
            .select()
            .single();

          return log;
        } catch (err) {
          // Log failure
          const errorMessage = err instanceof Error ? err.message : "Unknown error";
          
          const { data: log } = await supabase
            .from("email_logs")
            .insert({
              workspace_id: workspaceId,
              contact_id: email.contact_id || null,
              template_id: email.template_id || null,
              recipient_email: email.recipient_email,
              recipient_name: email.recipient_name || null,
              subject: email.subject,
              body: email.body,
              status: "failed",
              error_message: errorMessage,
              sent_by: user.id,
            })
            .select()
            .single();

          return log;
        }
      })
    );

    const logs = results
      .map((result) => (result.status === "fulfilled" ? result.value : null))
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      sent_count: logs.length,
      logs: logs as EmailLog[],
    });
  }

  // Handle single email sending
  const {
    contact_id,
    template_id,
    recipient_email,
    recipient_name,
    subject,
    body: emailBody,
  } = body;

  if (!recipient_email || !subject || !emailBody) {
    return NextResponse.json(
      { error: "recipient_email, subject, and body are required" },
      { status: 400 }
    );
  }

  let status: "sent" | "failed" = "sent";
  let errorMessage: string | null = null;

  try {
    // Send via Resend using workspace email settings
    await resend.emails.send({
      from,
      to: recipient_email,
      subject,
      html: emailBody,
      replyTo: replyTo,
    });
  } catch (err) {
    status = "failed";
    errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Error sending email via Resend:", err);
  }

  // Log the email attempt
  const { data: log, error } = await supabase
    .from("email_logs")
    .insert({
      workspace_id: workspaceId,
      contact_id: contact_id || null,
      template_id: template_id || null,
      recipient_email,
      recipient_name: recipient_name || null,
      subject,
      body: emailBody,
      status,
      error_message: errorMessage,
      sent_by: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Error logging email:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: status === "sent",
    log: log as EmailLog,
  });
}
