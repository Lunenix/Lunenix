import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailLog } from "@/types/database";

/**
 * POST /api/emails/send
 * Send an email (single or bulk) and log it
 * 
 * Body options:
 * - Single: { workspace_id, contact_id?, template_id?, recipient_email, recipient_name?, subject, body }
 * - Bulk: { workspace_id, emails: [{ contact_id?, recipient_email, recipient_name?, subject, body }] }
 * 
 * Note: This creates email log entries with status "sent". 
 * For production, integrate with an email service (SendGrid, Mailgun, AWS SES, etc.)
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
  const { workspace_id, emails } = body;

  if (!workspace_id) {
    return NextResponse.json(
      { error: "workspace_id is required" },
      { status: 400 }
    );
  }

  // Handle bulk email sending
  if (emails && Array.isArray(emails)) {
    const logEntries = emails.map((email) => ({
      workspace_id,
      contact_id: email.contact_id || null,
      template_id: email.template_id || null,
      recipient_email: email.recipient_email,
      recipient_name: email.recipient_name || null,
      subject: email.subject,
      body: email.body,
      status: "sent" as const,
      sent_by: user.id,
    }));

    const { data: logs, error } = await supabase
      .from("email_logs")
      .insert(logEntries)
      .select();

    if (error) {
      console.error("Error logging bulk emails:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

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

  // TODO: Integrate with actual email service provider
  // For now, just log the email as "sent"
  // In production, you would:
  // 1. Send via SendGrid/Mailgun/AWS SES
  // 2. Update status to "sent" or "failed" based on response
  // 3. Store error_message if failed

  const { data: log, error } = await supabase
    .from("email_logs")
    .insert({
      workspace_id,
      contact_id: contact_id || null,
      template_id: template_id || null,
      recipient_email,
      recipient_name: recipient_name || null,
      subject,
      body: emailBody,
      status: "sent",
      sent_by: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Error logging email:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    log: log as EmailLog,
  });
}
