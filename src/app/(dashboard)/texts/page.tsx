"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import {
  contactDisplayName,
  type Contact,
  type SmsMessage,
  type SmsThread,
} from "@/types/database";
import { Loader2 } from "lucide-react";

export default function TextsPage() {
  const { activeWorkspace, isLoading: wsLoading } = useWorkspace();
  const [platformOk, setPlatformOk] = useState(false);
  const [webhookOk, setWebhookOk] = useState(false);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [threads, setThreads] = useState<SmsThread[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [newContactId, setNewContactId] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    const id = activeWorkspace.id;
    const [s, t, c] = await Promise.all([
      fetch(`/api/sms/settings?workspaceId=${id}`),
      fetch(`/api/sms/threads?workspaceId=${id}`),
      fetch(`/api/contacts?workspaceId=${id}`),
    ]);
    const sj = await s.json().catch(() => ({}));
    const tj = await t.json().catch(() => ({}));
    const cj = await c.json().catch(() => ({}));
    if (s.ok) {
      setPlatformOk(Boolean(sj.platform_configured));
      setWebhookOk(Boolean(sj.webhook_ok));
      setDeepLink(typeof sj.deep_link === "string" ? sj.deep_link : null);
      setBotUsername(typeof sj.bot_username === "string" ? sj.bot_username : null);
    }
    if (t.ok) setThreads(tj.threads ?? []);
    if (c.ok) setContacts(cj.contacts ?? []);
    setLoading(false);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  const loadMessages = useCallback(async (threadId: string) => {
    const res = await fetch(`/api/sms/threads/${threadId}/messages`);
    const json = await res.json().catch(() => ({}));
    if (res.ok) setMessages(json.messages ?? []);
    else setMessages([]);
  }, []);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
    else setMessages([]);
  }, [activeId, loadMessages]);

  async function send(threadId?: string, contactId?: string) {
    if (!activeWorkspace || !draft.trim()) return;
    setSending(true);
    const res = await fetch("/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        body: draft.trim(),
        thread_id: threadId || undefined,
        contact_id: contactId || undefined,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) {
      toast(json.error ?? "Could not send that Telegram message.", "error");
      return;
    }
    setDraft("");
    await load();
    if (threadId) await loadMessages(threadId);
  }

  if (wsLoading || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center">
        <p className="text-muted-foreground">
          Create or select a workspace to message on Telegram.
        </p>
      </div>
    );
  }

  const contactsWithChat = contacts.filter((c) => c.telegram_chat_id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Texts</h1>
        <p className="text-sm text-muted-foreground">
          Two-way Telegram for {activeWorkspace.name}. Customers open the bot
          with this workspace link; replies land here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Telegram bot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {!platformOk ? (
            <p>
              Set <code className="text-xs">TELEGRAM_BOT_TOKEN</code> on the
              server. That is the same token used for task reminder pings.
            </p>
          ) : deepLink ? (
            <div className="space-y-2">
              <p>
                Bot token is live
                {botUsername ? ` (@${botUsername})` : ""}. Share this link so a
                client starts a thread in this workspace:{" "}
                <a
                  className="text-foreground underline"
                  href={deepLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  {deepLink}
                </a>
              </p>
              {!webhookOk ? (
                <p>
                  Inbound replies are not registered yet. Open this page on the
                  production https URL so Lunenix can set the Telegram webhook
                  from the bot token.
                </p>
              ) : null}
            </div>
          ) : (
            <p>
              Bot token is set. Open Texts on production so the app can read
              the bot username from Telegram.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Conversations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {threads.length === 0 ? (
              <p className="text-sm text-muted-foreground">No threads yet.</p>
            ) : (
              threads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setActiveId(thread.id)}
                  className={cn(
                    "w-full rounded-md px-2 py-2 text-left text-sm hover:bg-muted/60",
                    activeId === thread.id && "bg-muted"
                  )}
                >
                  {thread.contact
                    ? contactDisplayName(thread.contact)
                    : "Telegram chat"}
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {activeId ? "Thread" : "New message"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeId ? (
              <div className="max-h-[28rem] space-y-2 overflow-y-auto rounded-md border p-3">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages yet.</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "max-w-[80%] rounded-md px-3 py-2 text-sm",
                        m.direction === "outbound"
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {m.body}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Contact already linked to Telegram</Label>
                <Select
                  value={newContactId || "none"}
                  onValueChange={(v) => setNewContactId(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select contact" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select contact</SelectItem>
                    {contactsWithChat.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {contactDisplayName(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a Telegram message…"
              rows={3}
            />
            <Button
              disabled={sending || !draft.trim() || (!activeId && !newContactId)}
              onClick={() => send(activeId ?? undefined, newContactId || undefined)}
            >
              {sending ? "Sending…" : "Send"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
