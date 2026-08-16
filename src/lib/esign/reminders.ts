/**
 * Signing-reminder helper shared by the manual "Send reminder" route and the
 * scheduled cron scan. Sends the signer a fresh copy of the signing link,
 * increments the reminder counter, and records a 'reminded' audit event.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEsignEmail } from "@/lib/esign/sendEmail";

export interface RemindableDoc {
  id: string;
  workspace_id: string;
  name: string;
  sign_token: string | null;
  signer_name: string | null;
  signer_email: string | null;
  contact_id: string | null;
  reminder_count: number;
}

export const DEFAULT_REMINDER_INTERVAL_DAYS = 3;
export const DEFAULT_MAX_REMINDERS = 3;

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type AdminClient = SupabaseClient<any, any, any>;

export async function sendSigningReminder(
  admin: AdminClient,
  doc: RemindableDoc,
  baseUrl: string
): Promise<{ success: boolean; error?: string }> {
  if (!doc.sign_token) {
    return { success: false, error: "Document has no signing link" };
  }
  if (!doc.signer_email) {
    return { success: false, error: "Document has no signer email" };
  }

  const signUrl = `${baseUrl.replace(/\/$/, "")}/sign/${doc.sign_token}`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a1a2e">
      <h2 style="color:#2d2d6e">Reminder: a document is waiting for your signature</h2>
      <p>${doc.signer_name ? `Hi ${doc.signer_name},` : "Hello,"}</p>
      <p>This is a friendly reminder to review and electronically sign
      <strong>${doc.name}</strong>. It only takes a moment.</p>
      <p style="text-align:center;margin:32px 0">
        <a href="${signUrl}" style="background:#2d2d6e;color:#fff;text-decoration:none;
        padding:12px 28px;border-radius:8px;font-weight:bold;display:inline-block">
        Review &amp; Sign</a>
      </p>
      <p style="font-size:13px;color:#666">Or paste this link into your browser:<br>
      <a href="${signUrl}">${signUrl}</a></p>
      <hr style="border:none;border-top:1px solid #e5e5ef;margin:24px 0">
      <p style="font-size:12px;color:#999">Sent securely via Lunenix e-signature.</p>
    </div>`;

  const result = await sendEsignEmail({
    workspaceId: doc.workspace_id,
    to: doc.signer_email,
    toName: doc.signer_name,
    contactId: doc.contact_id,
    subject: `Reminder — please sign: ${doc.name}`,
    html,
  });

  const now = new Date().toISOString();
  await admin
    .from("esign_documents")
    .update({
      reminder_count: (doc.reminder_count || 0) + 1,
      last_reminder_at: now,
    })
    .eq("id", doc.id);

  await admin.from("esign_events").insert({
    document_id: doc.id,
    event_type: "reminded",
    metadata: { to: doc.signer_email, auto: false, success: result.success },
  });

  return result;
}
