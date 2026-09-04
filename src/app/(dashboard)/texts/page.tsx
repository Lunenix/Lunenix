"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  type WorkspaceSmsSettings,
} from "@/types/database";
import { Loader2 } from "lucide-react";

export default function TextsPage() {
  const { activeWorkspace, isLoading: wsLoading } = useWorkspace();
  const [settings, setSettings] = useState<WorkspaceSmsSettings | null>(null);
  const [platformOk, setPlatformOk] = useState(false);
  const [fromNumber, setFromNumber] = useState("");
  const [threads, setThreads] = useState<SmsThread[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [newContactId, setNewContactId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
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
      setSettings(sj.settings ?? null);
      setFromNumber(sj.settings?.from_e164 ?? "");
      setPlatformOk(Boolean(sj.platform_configured));
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

  async function saveSettings() {
    if (!activeWorkspace) return;
    setSavingSettings(true);
    const res = await fetch("/api/sms/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        from_e164: fromNumber.trim() || null,
        enabled: true,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSavingSettings(false);
    if (!res.ok) {
      toast(json.error ?? "Could not save SMS settings.", "error");
      return;
    }
    setSettings(json.settings);
    toast("SMS number saved.");
  }

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
      toast(json.error ?? "Could not send that text.", "error");
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
          Create or select a workspace to send texts.
        </p>
      </div>
    );
  }

  const contactsWithPhone = contacts.filter((c) => c.phone);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Texts</h1>
        <p className="text-sm text-muted-foreground">
          Two-way SMS for {activeWorkspace.name}. Replies land in this inbox
          when Twilio posts to this workspace&apos;s From number.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspace number</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!platformOk ? (
            <p className="text-sm text-muted-foreground">
              Platform Twilio is not configured yet. After{" "}
              <code className="text-xs">TWILIO_ACCOUNT_SID</code> and{" "}
              <code className="text-xs">TWILIO_AUTH_TOKEN</code> are set, save
              the From number here and point the Twilio webhook to{" "}
              <code className="text-xs">/api/sms/inbound</code>.
            </p>
          ) : null}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="from-e164">From (E.164)</Label>
              <Input
                id="from-e164"
                value={fromNumber}
                onChange={(e) => setFromNumber(e.target.value)}
                placeholder="+15551234567"
                className="w-56"
              />
            </div>
            <Button onClick={saveSettings} disabled={savingSettings}>
              {savingSettings ? "Saving…" : "Save number"}
            </Button>
          </div>
          {settings?.from_e164 ? (
            <p className="text-xs text-muted-foreground">
              Active From number: {settings.from_e164}
            </p>
          ) : null}
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
                    : "Unknown contact"}
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {activeId ? "Thread" : "New text"}
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
                <Label>Start with a contact</Label>
                <Select
                  value={newContactId || "none"}
                  onValueChange={(v) => setNewContactId(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Contact with a phone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select contact</SelectItem>
                    {contactsWithPhone.map((c) => (
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
              placeholder="Write a text…"
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
