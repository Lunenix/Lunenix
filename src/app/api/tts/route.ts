import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * ElevenLabs text-to-speech proxy — server-side only.
 *
 * ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID stay on the server. Accepts
 * `{ text }` from the client and streams the synthesized audio/mpeg buffer
 * back without exposing credentials.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_CHARS = 1000;

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    return NextResponse.json({ error: "TTS not configured" }, { status: 503 });
  }

  let text = "";
  try {
    const body = await req.json();
    text = typeof body?.text === "string" ? body.text : "";
  } catch {
    /* handled below */
  }

  if (!text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `text exceeds ${MAX_CHARS} characters` },
      { status: 400 }
    );
  }

  let elevenResponse: Response;
  try {
    elevenResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );
  } catch (e) {
    return NextResponse.json(
      {
        error: "TTS upstream error",
        detail: e instanceof Error ? e.message.slice(0, 200) : "unknown",
      },
      { status: 502 }
    );
  }

  if (!elevenResponse.ok || !elevenResponse.body) {
    return NextResponse.json(
      { error: "TTS upstream error", status: elevenResponse.status },
      { status: 502 }
    );
  }

  return new Response(elevenResponse.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
      "Transfer-Encoding": "chunked",
    },
  });
}
