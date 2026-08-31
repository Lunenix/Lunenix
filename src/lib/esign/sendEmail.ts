/**
 * E-signature email sender — thin wrapper over the general server email sender.
 */

import { sendServerEmail } from "@/lib/email/sendServerEmail";

export interface EsignEmailOptions {
  workspaceId: string;
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  contactId?: string | null;
  attachments?: { filename: string; content: string }[];
}

export async function sendEsignEmail(opts: EsignEmailOptions): Promise<{
  success: boolean;
  error?: string;
}> {
  return sendServerEmail(opts);
}
