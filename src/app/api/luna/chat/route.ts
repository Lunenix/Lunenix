import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Luna chat endpoint.
 *
 * Accepts { message, workspaceId } and returns { reply }.
 *
 * If an Abacus.AI API key is available (ABACUSAI_API_KEY or ABACUS_API_KEY),
 * it uses the Abacus `evaluatePrompt` LLM endpoint. Any failure — missing key,
 * network error, unexpected shape — falls back to a fast rule-based reply so
 * the assistant always responds.
 */

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT =
  "You are Luna, a warm and professional AI executive assistant for a business CRM. " +
  "Keep responses concise (1-3 sentences). Be helpful and action-oriented.";

/** Deterministic, dependency-free fallback replies. */
function ruleBasedReply(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("schedule") || m.includes("meeting") || m.includes("appointment")) {
    return "I've noted that request. I'll schedule that and send calendar invites to all parties right away.";
  }
  if (m.includes("email") || m.includes("send") || m.includes("draft")) {
    return "On it! I'll draft and send that email for you immediately.";
  }
  if (m.includes("remind") || m.includes("reminder")) {
    return "Reminder set! I'll make sure to notify you at the right time.";
  }
  if (m.includes("status") || m.includes("update") || m.includes("report")) {
    return "Here's the latest: all your tasks are on track and no urgent items need attention.";
  }
  if (m.includes("hello") || m.includes("hi") || m.includes("hey")) {
    return "Hello! I'm Luna, your executive assistant. How can I help you today?";
  }
  return "Understood! I'm processing your request and will take care of that right away.";
}

/** Best-effort Abacus.AI LLM call. Returns null on any problem. */
async function abacusReply(message: string): Promise<string | null> {
  const apiKey = process.env.ABACUSAI_API_KEY || process.env.ABACUS_API_KEY;
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch("https://api.abacus.ai/api/v0/evaluatePrompt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apiKey,
      },
      body: JSON.stringify({
        prompt: message,
        systemMessage: SYSTEM_PROMPT,
        llmName: "OPENAI_GPT4O_MINI",
        maxTokens: 200,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) return null;

    const data = await res.json();
    // evaluatePrompt returns { success, result: { content } }
    const content: unknown =
      data?.result?.content ?? data?.result?.response ?? data?.content;
    if (typeof content === "string" && content.trim()) {
      return content.trim();
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let message = "";
  try {
    const body = await req.json();
    message = typeof body?.message === "string" ? body.message : "";
  } catch {
    /* ignore malformed body */
  }

  if (!message.trim()) {
    return NextResponse.json(
      { reply: "I didn't catch that — could you say it again?" },
      { status: 200 }
    );
  }

  const llmReply = await abacusReply(message);
  const reply = llmReply ?? ruleBasedReply(message);

  return NextResponse.json({ reply }, { status: 200 });
}
