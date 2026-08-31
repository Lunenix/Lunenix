/**
 * General server-side email sender.
 *
 * Each workspace can send either through the shared Resend account (default)
 * or through its OWN SMTP mail account (provider = 'smtp'). Safe to call from
 * public/unauthenticated routes and from the automation engine. Logs every
 * attempt to email_logs and surfaces real provider errors.
 */

import { Resend } from "resend";
import nodemailer from "nodemailer";
import { createAdminClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/email/crypto";

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

interface SendResult {
  success: boolean;
  error?: string;
}

async function sendViaResend(
  from: string,
  replyTo: string | undefined,
  opts: ServerEmailOptions
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error:
        "Email is not configured: RESEND_API_KEY is missing. Add it in your environment settings.",
    };
  }
  const resend = new Resend(apiKey);
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
    // The Resend SDK does NOT throw on API errors — it returns them in `error`.
    if (error) {
      return {
        success: false,
        error: (error as { message?: string }).message || "Resend rejected the email.",
      };
    }
    if (!data?.id) {
      return { success: false, error: "Resend did not confirm the email was queued." };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown Resend error",
    };
  }
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
}

async function sendViaSmtp(
  cfg: SmtpConfig,
  from: string,
  replyTo: string | undefined,
  opts: ServerEmailOptions
): Promise<SendResult> {
  try {
    const transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure, // true for 465, false for 587/25 (STARTTLS)
      auth: { user: cfg.username, pass: cfg.password },
    });
    await transport.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      replyTo,
      attachments: opts.attachments?.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content, "base64"),
      })),
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown SMTP error",
    };
  }
}

export async function sendServerEmail(
  opts: ServerEmailOptions
): Promise<SendResult> {
  const admin = createAdminClient();

  const { data: settings } = await admin
    .from("email_settings")
    .select("*")
    .eq("workspace_id", opts.workspaceId)
    .maybeSingle();

  const replyTo = settings?.reply_to || undefined;

  let result: SendResult;

  if (settings?.provider === "smtp") {
    // Send through the workspace's own SMTP account.
    const password = decryptSecret(settings.smtp_password_enc);
    if (
      !settings.smtp_host ||
      !settings.smtp_port ||
      !settings.smtp_username ||
      !password
    ) {
      result = {
        success: false,
        error:
          "SMTP is selected but not fully configured (host, port, username, and password are required).",
      };
    } else {
      const fromEmail = settings.from_email || settings.smtp_username;
      const fromName = settings.from_name || DEFAULT_FROM_NAME;
      const from = `${fromName} <${fromEmail}>`;
      result = await sendViaSmtp(
        {
          host: settings.smtp_host,
          port: settings.smtp_port,
          secure: settings.smtp_secure ?? true,
          username: settings.smtp_username,
          password,
        },
        from,
        replyTo,
        opts
      );
    }
  } else {
    // Default: shared Resend account.
    const fromEmail = settings?.from_email || DEFAULT_FROM_EMAIL;
    const fromName = settings?.from_name || DEFAULT_FROM_NAME;
    const from = `${fromName} <${fromEmail}>`;
    result = await sendViaResend(from, replyTo, opts);
  }

  if (!result.success) {
    console.error("Email send failed:", result.error);
  }

  await admin.from("email_logs").insert({
    workspace_id: opts.workspaceId,
    contact_id: opts.contactId || null,
    template_id: opts.templateId || null,
    recipient_email: opts.to,
    recipient_name: opts.toName || null,
    subject: opts.subject,
    body: opts.html,
    status: result.success ? "sent" : "failed",
    error_message: result.error || null,
  });

  return result;
}
