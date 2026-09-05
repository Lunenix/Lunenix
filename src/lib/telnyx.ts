import "server-only";

import { npaFromE164, normalizeE164 } from "@/lib/sms";
import { createPublicKey, verify } from "crypto";

const TELNYX_API = "https://api.telnyx.com/v2";

function apiKey(): string | null {
  const key = process.env.TELNYX_API_KEY?.trim();
  return key || null;
}

export function telnyxConfigured(): boolean {
  return Boolean(apiKey());
}

export function telnyxMessagingProfileId(): string | null {
  const id = process.env.TELNYX_MESSAGING_PROFILE_ID?.trim();
  return id || null;
}

async function telnyxFetch<T>(
  path: string,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const token = apiKey();
  if (!token) return { ok: false, error: "TELNYX_API_KEY is not set." };
  const res = await fetch(`${TELNYX_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: T;
    errors?: Array<{ detail?: string; title?: string }>;
  };
  if (!res.ok) {
    const detail =
      json.errors?.[0]?.detail ||
      json.errors?.[0]?.title ||
      `Telnyx ${res.status}`;
    return { ok: false, error: detail };
  }
  return { ok: true, data: (json.data ?? json) as T };
}

type AvailableNumber = { phone_number?: string };

export async function provisionWorkspaceTelnyxNumber(opts: {
  companyPhone: string;
}): Promise<
  | { e164: string; telnyxNumberId: string | null; areaCode: string | null }
  | { error: string }
> {
  if (!telnyxConfigured()) {
    return { error: "TELNYX_API_KEY is not set." };
  }
  const company = normalizeE164(opts.companyPhone);
  const areaCode = company ? npaFromE164(company) : null;
  const profileId = telnyxMessagingProfileId();

  async function search(npa: string | null): Promise<string | null> {
    const params = new URLSearchParams();
    params.set("filter[country_code]", "US");
    params.set("filter[phone_number_type]", "local");
    params.set("filter[features]", "sms");
    params.set("filter[limit]", "5");
    if (npa) params.set("filter[national_destination_code]", npa);
    const listed = await telnyxFetch<AvailableNumber[]>(
      `/available_phone_numbers?${params.toString()}`
    );
    if (!listed.ok) return null;
    const rows = Array.isArray(listed.data) ? listed.data : [];
    const first = rows.find((r) => typeof r.phone_number === "string");
    return first?.phone_number ?? null;
  }

  let phone = await search(areaCode);
  if (!phone && areaCode) phone = await search(null);
  if (!phone) {
    return { error: "No SMS-capable local numbers were available in Telnyx." };
  }

  const orderBody: Record<string, unknown> = {
    phone_numbers: [{ phone_number: phone }],
  };
  if (profileId) orderBody.messaging_profile_id = profileId;

  const ordered = await telnyxFetch<{
    id?: string;
    phone_numbers?: Array<{
      phone_number?: string;
      id?: string;
      phone_number_id?: string;
    }>;
  }>("/number_orders", {
    method: "POST",
    body: JSON.stringify(orderBody),
  });
  if (!ordered.ok) return { error: ordered.error };

  const e164 =
    ordered.data.phone_numbers?.[0]?.phone_number ?? phone;
  const telnyxNumberId =
    ordered.data.phone_numbers?.[0]?.id ??
    ordered.data.phone_numbers?.[0]?.phone_number_id ??
    ordered.data.id ??
    null;

  if (profileId && e164) {
    await telnyxFetch(`/messaging_phone_numbers/${encodeURIComponent(e164)}`, {
      method: "PATCH",
      body: JSON.stringify({ messaging_profile_id: profileId }),
    });
  }

  return {
    e164,
    telnyxNumberId,
    areaCode,
  };
}

export async function sendTelnyxSms(opts: {
  from: string;
  to: string;
  text: string;
}): Promise<{ id: string } | { error: string }> {
  const from = normalizeE164(opts.from);
  const to = normalizeE164(opts.to);
  if (!from || !to) return { error: "Need valid from and to numbers." };
  const profileId = telnyxMessagingProfileId();
  const body: Record<string, unknown> = {
    from,
    to,
    text: opts.text.slice(0, 1600),
    type: "SMS",
  };
  if (profileId) body.messaging_profile_id = profileId;
  const sent = await telnyxFetch<{ id?: string }>("/messages", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!sent.ok) return { error: sent.error };
  const id = typeof sent.data.id === "string" ? sent.data.id : "";
  if (!id) return { error: "Telnyx did not return a message id." };
  return { id };
}

function ed25519PublicKeyFromEnv(): ReturnType<typeof createPublicKey> | null {
  const raw = process.env.TELNYX_PUBLIC_KEY?.trim();
  if (!raw) return null;
  try {
    if (raw.includes("BEGIN PUBLIC KEY")) {
      return createPublicKey(raw);
    }
    const derPrefix = Buffer.from("302a300506032b6570032100", "hex");
    const body = Buffer.from(raw, "base64");
    const spki = body.length === 32 ? Buffer.concat([derPrefix, body]) : body;
    return createPublicKey({ key: spki, format: "der", type: "spki" });
  } catch {
    return null;
  }
}

export function verifyTelnyxWebhook(opts: {
  rawBody: string;
  signatureB64: string | null;
  timestamp: string | null;
}): boolean {
  const key = ed25519PublicKeyFromEnv();
  if (!key) return false;
  const sig = opts.signatureB64?.trim();
  const ts = opts.timestamp?.trim();
  if (!sig || !ts) return false;
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  if (Math.abs(Date.now() / 1000 - tsNum) > 300) return false;
  try {
    return verify(
      null,
      Buffer.from(`${ts}|${opts.rawBody}`),
      key,
      Buffer.from(sig, "base64")
    );
  } catch {
    return false;
  }
}
