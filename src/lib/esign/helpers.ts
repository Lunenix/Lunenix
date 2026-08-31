/**
 * Shared server-side helpers for the e-signature module.
 */

import { randomBytes } from "crypto";
import type { NextRequest } from "next/server";

/** URL-safe opaque token for public signing links. */
export function generateSignToken(): string {
  return randomBytes(24).toString("base64url");
}

export function getClientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || null;
}

export function getUserAgent(req: NextRequest): string | null {
  return req.headers.get("user-agent") || null;
}

/** Absolute base URL of the app, for building signing links in emails. */
export function getAppBaseUrl(req?: NextRequest): string {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : undefined);
  if (envUrl) return envUrl.replace(/\/$/, "");
  if (req) {
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const host = req.headers.get("host");
    if (host) return `${proto}://${host}`;
  }
  return "http://localhost:3000";
}
