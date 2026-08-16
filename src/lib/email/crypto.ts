/**
 * Symmetric encryption for mail credentials (SMTP/IMAP passwords).
 *
 * Passwords are stored encrypted at rest in `email_settings` and are only ever
 * decrypted server-side (service role) right before opening a connection. They
 * are NEVER returned to the browser.
 *
 * Key: derived from EMAIL_ENCRYPTION_KEY if set, otherwise from the Supabase
 * service role key (always present server-side). Uses AES-256-GCM.
 */

import crypto from "crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const secret =
    process.env.EMAIL_ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  if (!secret) {
    throw new Error(
      "No encryption secret available (set EMAIL_ENCRYPTION_KEY or SUPABASE_SERVICE_ROLE_KEY)."
    );
  }
  // Deterministic 32-byte key from the secret.
  return crypto.scryptSync(secret, "lunenix-email-cred", 32);
}

/** Encrypt a plaintext string. Returns "iv:tag:ciphertext" (all base64). */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString(
    "base64"
  )}`;
}

/** Decrypt a string produced by encryptSecret. Returns null on failure. */
export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    const [ivB64, tagB64, dataB64] = payload.split(":");
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const decipher = crypto.createDecipheriv(
      ALGO,
      getKey(),
      Buffer.from(ivB64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch (err) {
    console.error("Failed to decrypt mail credential:", err);
    return null;
  }
}
