/**
 * IMAP inbound sync — pulls new messages from a workspace's own mailbox into
 * the in-app inbox (`inbound_emails`).
 *
 * Runs server-side only (Node runtime). Uses imapflow to connect, fetches
 * messages newer than the last stored UID, parses them, matches a contact by
 * sender address, and stores them. Designed to be called on-demand ("Sync now")
 * and from a scheduled cron.
 */

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { createAdminClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/email/crypto";

const MAX_MESSAGES_PER_SYNC = 50;

export interface ImapSyncResult {
  success: boolean;
  imported: number;
  error?: string;
}

interface SettingsRow {
  workspace_id: string;
  imap_enabled: boolean;
  imap_host: string | null;
  imap_port: number | null;
  imap_secure: boolean;
  imap_username: string | null;
  imap_password_enc: string | null;
  imap_last_uid: number | null;
}

export async function syncWorkspaceInbox(
  workspaceId: string
): Promise<ImapSyncResult> {
  const admin = createAdminClient();

  const { data: settings } = await admin
    .from("email_settings")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle<SettingsRow>();

  if (!settings || !settings.imap_enabled) {
    return { success: false, imported: 0, error: "IMAP is not enabled for this workspace." };
  }

  const password = decryptSecret(settings.imap_password_enc);
  if (!settings.imap_host || !settings.imap_port || !settings.imap_username || !password) {
    const error = "IMAP is not fully configured (host, port, username, password).";
    await admin
      .from("email_settings")
      .update({ imap_last_error: error })
      .eq("workspace_id", workspaceId);
    return { success: false, imported: 0, error };
  }

  const client = new ImapFlow({
    host: settings.imap_host,
    port: settings.imap_port,
    secure: settings.imap_secure ?? true,
    auth: { user: settings.imap_username, pass: password },
    logger: false,
  });

  let imported = 0;
  const lastUid = settings.imap_last_uid || 0;
  let maxUid = lastUid;

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      // Fetch messages with UID greater than the last one we saw. On the very
      // first sync (lastUid = 0), grab only the most recent messages.
      const range = lastUid > 0 ? `${lastUid + 1}:*` : "1:*";
      const collected: {
        uid: number;
        source: Buffer;
      }[] = [];

      for await (const msg of client.fetch(
        range,
        { uid: true, source: true },
        { uid: true }
      )) {
        if (msg.uid <= lastUid) continue;
        collected.push({ uid: msg.uid, source: msg.source as Buffer });
      }

      // On first sync, keep only the newest N to avoid importing years of mail.
      const toProcess =
        lastUid === 0 ? collected.slice(-MAX_MESSAGES_PER_SYNC) : collected;

      for (const item of toProcess) {
        if (item.uid > maxUid) maxUid = item.uid;
        let parsed;
        try {
          parsed = await simpleParser(item.source);
        } catch {
          continue;
        }

        const fromAddr = parsed.from?.value?.[0];
        const fromEmail = (fromAddr?.address || "unknown").toLowerCase();
        const fromName = fromAddr?.name || null;
        const toEmail =
          (Array.isArray(parsed.to) ? parsed.to[0]?.text : parsed.to?.text) || null;

        // Try to match an existing contact by sender email.
        let contactId: string | null = null;
        const { data: contact } = await admin
          .from("contacts")
          .select("id")
          .eq("workspace_id", workspaceId)
          .ilike("email", fromEmail)
          .maybeSingle();
        if (contact) contactId = contact.id;

        const { error: insertErr } = await admin.from("inbound_emails").insert({
          workspace_id: workspaceId,
          contact_id: contactId,
          message_id: parsed.messageId || `uid-${item.uid}@lunenix`,
          imap_uid: item.uid,
          from_email: fromEmail,
          from_name: fromName,
          to_email: toEmail,
          subject: parsed.subject || "(no subject)",
          body_text: parsed.text || null,
          body_html: typeof parsed.html === "string" ? parsed.html : null,
          received_at: (parsed.date || new Date()).toISOString(),
        });
        // Ignore unique-violation dedupes; count real inserts.
        if (!insertErr) imported++;
      }
    } finally {
      lock.release();
    }
    await client.logout();

    await admin
      .from("email_settings")
      .update({
        imap_last_uid: maxUid,
        imap_last_synced_at: new Date().toISOString(),
        imap_last_error: null,
      })
      .eq("workspace_id", workspaceId);

    return { success: true, imported };
  } catch (err) {
    const error = err instanceof Error ? err.message : "IMAP sync failed";
    try {
      await client.logout();
    } catch {
      /* noop */
    }
    await admin
      .from("email_settings")
      .update({ imap_last_error: error })
      .eq("workspace_id", workspaceId);
    return { success: false, imported, error };
  }
}
