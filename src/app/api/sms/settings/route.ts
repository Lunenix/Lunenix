import { NextResponse, type NextRequest } from "next/server";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { workspaceStartParam } from "@/lib/sms";
import { getAppBaseUrl } from "@/lib/esign/helpers";
import {
  ensureTelegramWebhook,
  fetchTelegramBotUsername,
  telegramBotConfigured,
} from "@/lib/notify/telegram";

function publicAppBase(request: NextRequest): string {
  const fromReq = getAppBaseUrl(request);
  if (
    fromReq.startsWith("https://") &&
    !/localhost|127\.0\.0\.1/.test(fromReq)
  ) {
    return fromReq;
  }
  const prodHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prodHost) {
    return `https://${prodHost.replace(/^https?:\/\//, "")}`.replace(/\/$/, "");
  }
  return fromReq;
}

export async function GET(request: NextRequest) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;

  const configured = telegramBotConfigured();
  const username = configured ? await fetchTelegramBotUsername() : null;
  const start = workspaceStartParam(auth.workspaceId);
  const deepLink = username
    ? `https://t.me/${username}?start=${start}`
    : null;

  let webhookOk = false;
  if (configured) {
    const base = publicAppBase(request);
    const hook = await ensureTelegramWebhook(base);
    webhookOk = hook.ok;
  }

  return NextResponse.json({
    platform_configured: configured,
    bot_username: username,
    start_param: start,
    deep_link: deepLink,
    webhook_ok: webhookOk,
  });
}
