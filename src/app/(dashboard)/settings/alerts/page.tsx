"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell } from "lucide-react";

export default function AlertSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Alerts</h2>
        <p className="text-muted-foreground">
          Task reminders go through your Telegram bot only.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Telegram bot
          </CardTitle>
          <CardDescription>
            Lunenix uses <code className="text-xs">TELEGRAM_BOT_TOKEN</code> and{" "}
            <code className="text-xs">TELEGRAM_CHAT_ID</code> on the server. There is
            no SMS or Twilio path.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Set a due date and “remind me (minutes before)” on a task. The daily
            cron posts to that chat when the window opens (due dates count as
            9:00 AM UTC that day).
          </p>
          <p>
            A one-shot pipeline test is{" "}
            <code className="text-xs">POST /api/telegram/test</code> with{" "}
            <code className="text-xs">CRON_SECRET</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
