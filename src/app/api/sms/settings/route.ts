import { NextResponse } from "next/server";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import { workspaceStartParam } from "@/lib/sms";
import {
  telegramBotConfigured,
  telegramBotUsername,
} from "@/lib/notify/telegram";

export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;
  const username = telegramBotUsername();
  const start = workspaceStartParam(auth.workspaceId);
  const deepLink = username
    ? `https://t.me/${username}?start=${start}`
    : null;
  return NextResponse.json({
    platform_configured: telegramBotConfigured(),
    bot_username: username,
    start_param: start,
    deep_link: deepLink,
  });
}
