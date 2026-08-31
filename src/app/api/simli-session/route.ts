import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Simli session bootstrap — server-side only.
 *
 * SIMLI_API_KEY and SIMLI_AVATAR_ID never leave this handler. The route:
 *   1. Mints a short-lived session token (`POST /compose/token`).
 *   2. Fetches TURN/STUN ICE servers (`GET /compose/ice`).
 *
 * The client receives only a temporary token (plus ICE config for WebRTC).
 * Those are not the Simli API key and cannot be reused to mint new sessions.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SIMLI_BASE = "https://api.simli.ai";

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.SIMLI_API_KEY;
  const faceId = process.env.SIMLI_AVATAR_ID;

  if (!apiKey || !faceId) {
    return NextResponse.json({ error: "Simli not configured" }, { status: 503 });
  }

  try {
    // 1. Mint session token
    const tokenRes = await fetch(`${SIMLI_BASE}/compose/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-simli-api-key": apiKey,
      },
      body: JSON.stringify({
        faceId,
        handleSilence: false,
        maxSessionLength: 3600,
        maxIdleTime: 300,
        model: "fasttalk",
      }),
    });

    if (!tokenRes.ok) {
      const detail = await tokenRes.text();
      return NextResponse.json(
        { error: "Simli session error", status: tokenRes.status, detail: detail.slice(0, 200) },
        { status: 502 }
      );
    }

    const tokenJson = await tokenRes.json();
    const sessionToken: string | undefined = tokenJson?.session_token;
    if (!sessionToken) {
      return NextResponse.json(
        { error: "Simli returned no session token" },
        { status: 502 }
      );
    }

    // 2. Fetch ICE servers (fall back to public STUN on any failure)
    let iceServers: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302"] }];
    try {
      const iceRes = await fetch(`${SIMLI_BASE}/compose/ice`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-simli-api-key": apiKey,
        },
      });
      if (iceRes.ok) {
        const servers = await iceRes.json();
        if (Array.isArray(servers) && servers.length) iceServers = servers;
      }
    } catch {
      /* keep STUN fallback */
    }

    return NextResponse.json({ sessionToken, iceServers }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      {
        error: "Simli session error",
        detail: e instanceof Error ? e.message.slice(0, 200) : "unknown",
      },
      { status: 502 }
    );
  }
}
