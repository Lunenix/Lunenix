"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { createClient } from "@/lib/supabase/client";
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
  const [fromE164, setFromE164] = useState<string | null>(null);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [threads, setThreads] = useState<SmsThread[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [newContactId, setNewContactId] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [provisioning, setProvisioning] = useState(false);

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
      setFromE164(typeof sj.from_e164 === "string" ? sj.from_e164 : null);
      setProvisionError(
        typeof sj.provision_error === "string" ? sj.provision_error : null
      );
    }
    if (t.ok) setThreads(tj.threads ?? []);
    if (c.ok) setContacts(cj.contacts ?? []);
    setLoading(false);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  useEffect(() => {
    if (!activeWorkspace) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`sms-inbox-${activeWorkspace.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sms_messages",
          filter: `workspace_id=eq.${activeWorkspace.id}`,
        },
        () => {
          void load();
          if (activeId) {
            void fetch(`/api/sms/threads/${activeId}/messages`)
              .then((res) => res.json())
              .then((json) => {
                if (Array.isArray(json.messages)) setMessages(json.messages);
              });
          }
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeWorkspace, activeId, load]);

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
      toast(json.error ?? "Could not send that text.", "error");
      return;
    }
    setDraft("");
    await load();
    if (threadId) await loadMessages(threadId);
  }

  async function provision() {
    if (!activeWorkspace) return;
    setProvisioning(true);
    const res = await fetch("/api/sms/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: activeWorkspace.id }),
    });
    const json = await res.json().catch(() => ({}));
    setProvisioning(false);
    if (!res.ok) {
      toast(json.error ?? "Could not buy a number.", "error");
      return;
    }
    toast("Workspace number ready.");
    load();
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
          Shared SMS inbox for {activeWorkspace.name}. Outbound uses this
          workspace’s Telnyx number. Replies stream here for the whole team.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspace number</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {!platformOk ? (
            <p>
              Set <code className="text-xs">TELNYX_API_KEY</code> (and{" "}
              <code className="text-xs">TELNYX_MESSAGING_PROFILE_ID</code>) on
              the server. New companies buy a local 10DLC number from the
              company area code on create.
            </p>
          ) : fromE164 ? (
            <p>
              Sending from <span className="text-foreground">{fromE164}</span>.
              Point the Telnyx messaging profile webhook at{" "}
              <code className="text-xs">/api/telnyx/webhook</code>.
            </p>
          ) : (
            <div className="space-y-2">
              <p>
                No Telnyx number is bound yet
                {provisionError ? `: ${provisionError}` : "."}
              </p>
              <Button
                size="sm"
                onClick={provision}
                disabled={provisioning}
              >
                {provisioning ? "Buying…" : "Buy local number"}
              </Button>
            </div>
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
                    : thread.contact_phone || "SMS thread"}
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
                <Label>Contact with a mobile number</Label>
                <Select
                  value={newContactId || "none"}
                  onValueChange={(v) => setNewContactId(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select contact" />
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
