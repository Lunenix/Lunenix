import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { SMS_BODY_MAX, toE164 } from "@/lib/sms";

type TwilioConfig = {
  accountSid: string;
  authToken: string;
};

export function getTwilioConfig(): TwilioConfig | { error: string } {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() ?? "";
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() ?? "";
  if (!accountSid || !authToken) {
    return {
      error:
        "Two-way texting is not configured on the server. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.",
    };
  }
  return { accountSid, authToken };
}

export function twilioWebhookUrl(requestUrl: string): string {
  const configured = process.env.TWILIO_WEBHOOK_URL?.trim();
  if (configured) return configured;
  try {
    const url = new URL(requestUrl);
    return `${url.origin}/api/sms/inbound`;
  } catch {
    return requestUrl;
  }
}

/**
 * Twilio request signature. Params must be the posted form fields, not headers.
 */
export function isValidTwilioSignature(opts: {
  authToken: string;
  signature: string | null;
  url: string;
  params: Record<string, string>;
}): boolean {
  if (!opts.signature) return false;
  const data =
    opts.url +
    Object.keys(opts.params)
      .sort()
      .map((key) => key + opts.params[key])
      .join("");
  const expected = createHmac("sha1", opts.authToken)
    .update(Buffer.from(data, "utf8"))
    .digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(opts.signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function sendTwilioSms(opts: {
  from: string;
  to: string;
  body: string;
}): Promise<{ sid: string } | { error: string }> {
  const cfg = getTwilioConfig();
  if ("error" in cfg) return cfg;
  const from = toE164(opts.from);
  const to = toE164(opts.to);
  if (!from || !to) {
    return { error: "From and to numbers must be valid phone numbers." };
  }
  const body = opts.body.trim().slice(0, SMS_BODY_MAX);
  if (!body) return { error: "Message body is required." };

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`;
  const form = new URLSearchParams({ From: from, To: to, Body: body });
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization:
        "Basic " + Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const json = (await res.json().catch(() => ({}))) as {
    sid?: string;
    message?: string;
  };
  if (!res.ok || !json.sid) {
    return { error: json.message ?? "Could not send that text." };
  }
  return { sid: json.sid };
}
