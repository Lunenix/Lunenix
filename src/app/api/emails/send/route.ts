import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailLog } from "@/types/database";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Default "from" address - use onboarding@resend.dev for testing
// In production, replace with your verified domain email (e.g., hello@yourdomain.com)
const DEFAULT_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

/**
 * POST /api/emails/send
 * Send an email (single or bulk) via Resend and log it
 * 
 * Body options:
 * - Single: { workspace_id, contact_id?, template_id?, recipient_email, recipient_name?, subject, body }
 * - Bulk: { workspace_id, emails: [{ contact_id?, recipient_email, recipient_name?, subject, body }] }
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
    const results = await Promise.allSettled(
      emails.map(async (email) => {
        try {
          // Send via Resend
          await resend.emails.send({
            from: DEFAULT_FROM_EMAIL,
            to: email.recipient_email,
            subject: email.subject,
            html: email.body,
          });

          // Log success
          const { data: log } = await supabase
            .from("email_logs")
            .insert({
              workspace_id,
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
              workspace_id,
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
    // Send via Resend
    await resend.emails.send({
      from: DEFAULT_FROM_EMAIL,
      to: recipient_email,
      subject,
      html: emailBody,
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
      workspace_id,
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
