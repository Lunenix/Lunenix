/**
 * Server-only Twilio SMS. Credentials stay in env, never in the client.
 */

function toE164(phone: string): string {
  return phone.startsWith("+") ? phone : `+${phone}`;
}

export function twilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_FROM_NUMBER?.trim()
  );
}

export async function sendSmsAlert(
  to: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM_NUMBER?.trim();
  if (!sid || !token || !from) {
    return { ok: false, error: "SMS is not configured." };
  }

  const dest = toE164(to);
  const body = new URLSearchParams({
    To: dest,
    From: from.startsWith("+") ? from : `+${from}`,
    Body: text.slice(0, 1600),
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  if (!res.ok) {
    return { ok: false, error: "SMS provider rejected the message." };
  }
  return { ok: true };
}
