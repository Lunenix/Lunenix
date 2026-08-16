"use client";

import { useEffect, useState, useCallback } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Inbox, RefreshCw, Trash2, Mail } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { contactDisplayName } from "@/types/database";
import type { InboundEmail } from "@/types/database";
import Link from "next/link";

export default function InboxPage() {
  const { activeWorkspace, isLoading: workspaceLoading } = useWorkspace();
  const [emails, setEmails] = useState<InboundEmail[]>([]);
  const [selected, setSelected] = useState<InboundEmail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; msg: string } | null>(null);

  const fetchEmails = useCallback(async () => {
    if (!activeWorkspace) return;
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/emails/inbound?workspaceId=${activeWorkspace.id}`
      );
      const data = await res.json();
      setEmails(data.emails || []);
    } catch (err) {
      console.error("Error loading inbox:", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) fetchEmails();
  }, [activeWorkspace, fetchEmails]);

  async function handleSync() {
    if (!activeWorkspace) return;
    setIsSyncing(true);
    setNotice(null);
    try {
      const res = await fetch("/api/emails/inbound/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: activeWorkspace.id }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || "Sync failed");
      }
      setNotice({
        ok: true,
        msg: `Synced. ${data.imported ?? 0} new message${data.imported === 1 ? "" : "s"}.`,
      });
      await fetchEmails();
    } catch (err) {
      setNotice({
        ok: false,
        msg:
          err instanceof Error
            ? err.message
            : "Sync failed. Check your IMAP settings.",
      });
    } finally {
      setIsSyncing(false);
    }
  }

  async function openEmail(email: InboundEmail) {
    setSelected(email);
    if (!email.is_read) {
      // Optimistically mark read.
      setEmails((prev) =>
        prev.map((e) => (e.id === email.id ? { ...e, is_read: true } : e))
      );
      try {
        await fetch(`/api/emails/inbound/${email.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_read: true }),
        });
      } catch {
        /* non-fatal */
      }
    }
  }

  async function handleDelete(email: InboundEmail) {
    if (!confirm("Delete this email from your inbox?")) return;
    try {
      await fetch(`/api/emails/inbound/${email.id}`, { method: "DELETE" });
      setEmails((prev) => prev.filter((e) => e.id !== email.id));
      if (selected?.id === email.id) setSelected(null);
    } catch (err) {
      console.error("Error deleting email:", err);
    }
  }

  function senderLabel(email: InboundEmail) {
    if (email.contact) return contactDisplayName(email.contact);
    return email.from_name || email.from_email;
  }

  if (workspaceLoading || isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">No active workspace selected</p>
      </div>
    );
  }

  const unreadCount = emails.filter((e) => !e.is_read).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Inbox className="h-7 w-7" />
            Inbox
            {unreadCount > 0 && (
              <Badge variant="default">{unreadCount} unread</Badge>
            )}
          </h2>
          <p className="text-muted-foreground">
            Email received into your connected mailbox.
          </p>
        </div>
        <Button onClick={handleSync} disabled={isSyncing}>
          {isSyncing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sync now
        </Button>
      </div>

      {notice && (
        <p
          className={`text-sm font-medium ${
            notice.ok ? "text-green-600" : "text-destructive"
          }`}
        >
          {notice.msg}
        </p>
      )}

      {emails.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              No emails yet
            </CardTitle>
            <CardDescription>
              Enable inbox syncing under{" "}
              <Link href="/settings/email" className="underline">
                Email Settings
              </Link>{" "}
              (IMAP), then click <strong>Sync now</strong> to pull in your
              received mail.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          {/* List */}
          <div className="space-y-1 lg:max-h-[70vh] lg:overflow-y-auto">
            {emails.map((email) => (
              <button
                key={email.id}
                onClick={() => openEmail(email)}
                className={`w-full rounded-md border p-3 text-left transition-colors hover:bg-accent ${
                  selected?.id === email.id ? "border-primary bg-accent" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`truncate text-sm ${
                      email.is_read ? "font-normal" : "font-semibold"
                    }`}
                  >
                    {senderLabel(email)}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(email.received_at)}
                  </span>
                </div>
                <div
                  className={`truncate text-sm ${
                    email.is_read ? "text-muted-foreground" : "font-medium"
                  }`}
                >
                  {email.subject || "(no subject)"}
                </div>
                {email.contact && (
                  <Badge variant="secondary" className="mt-1">
                    Linked contact
                  </Badge>
                )}
              </button>
            ))}
          </div>

          {/* Detail */}
          <Card className="lg:sticky lg:top-4 lg:max-h-[70vh] lg:overflow-y-auto">
            {selected ? (
              <>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="break-words">
                        {selected.subject || "(no subject)"}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        From{" "}
                        <strong>{selected.from_name || selected.from_email}</strong>{" "}
                        &lt;{selected.from_email}&gt;
                        <br />
                        {formatDateTime(selected.received_at)}
                        {selected.to_email && <> · to {selected.to_email}</>}
                      </CardDescription>
                      {selected.contact && (
                        <Link
                          href={`/contacts/${selected.contact.id}`}
                          className="mt-1 inline-block text-sm underline"
                        >
                          View {contactDisplayName(selected.contact)}
                        </Link>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(selected)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {selected.body_html ? (
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert"
                      // Inbound HTML is rendered read-only; provider content.
                      dangerouslySetInnerHTML={{ __html: selected.body_html }}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap break-words font-sans text-sm">
                      {selected.body_text || "(no content)"}
                    </pre>
                  )}
                </CardContent>
              </>
            ) : (
              <CardContent className="flex min-h-[300px] items-center justify-center">
                <p className="text-muted-foreground">
                  Select an email to read it.
                </p>
              </CardContent>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
