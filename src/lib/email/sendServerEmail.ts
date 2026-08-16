/**
 * General server-side email sender (Resend + admin client).
 *
 * Safe to call from public/unauthenticated routes and from the automation
 * engine. Respects per-workspace email settings and logs to email_logs.
 */

import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/server";

const resend = new Resend(process.env.RESEND_API_KEY);
const DEFAULT_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
const DEFAULT_FROM_NAME = "Lunenix";

export interface ServerEmailOptions {
  workspaceId: string;
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  contactId?: string | null;
  templateId?: string | null;
  attachments?: { filename: string; content: string }[]; // content = base64
}

export async function sendServerEmail(opts: ServerEmailOptions): Promise<{
  success: boolean;
  error?: string;
}> {
  const admin = createAdminClient();

  const { data: settings } = await admin
    .from("email_settings")
    .select("*")
    .eq("workspace_id", opts.workspaceId)
    .maybeSingle();

  const fromEmail = settings?.from_email || DEFAULT_FROM_EMAIL;
  const fromName = settings?.from_name || DEFAULT_FROM_NAME;
  const from = `${fromName} <${fromEmail}>`;
  const replyTo = settings?.reply_to || undefined;

  let status: "sent" | "failed" = "sent";
  let errorMessage: string | null = null;

  if (!process.env.RESEND_API_KEY) {
    status = "failed";
    errorMessage =
      "Email is not configured: RESEND_API_KEY is missing. Add it in your environment settings.";
    console.error(errorMessage);
  } else {
    try {
      const { data, error } = await resend.emails.send({
        from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        replyTo,
        attachments: opts.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
        })),
      });

      // The Resend SDK does NOT throw on API errors (e.g. unverified domain,
      // test-mode recipient restrictions). It returns them in `error`, so we
      // must inspect the response to know whether the email actually sent.
      if (error) {
        status = "failed";
        errorMessage =
          (error as { message?: string }).message || "Resend rejected the email.";
        console.error("Resend returned an error:", error);
      } else if (!data?.id) {
        status = "failed";
        errorMessage = "Resend did not confirm the email was queued.";
        console.error("Resend returned no id:", data);
      }
    } catch (err) {
      status = "failed";
      errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Error sending server email via Resend:", err);
    }
  }

  await admin.from("email_logs").insert({
    workspace_id: opts.workspaceId,
    contact_id: opts.contactId || null,
    template_id: opts.templateId || null,
    recipient_email: opts.to,
    recipient_name: opts.toName || null,
    subject: opts.subject,
    body: opts.html,
    status,
    error_message: errorMessage,
  });

  return { success: status === "sent", error: errorMessage || undefined };
}
