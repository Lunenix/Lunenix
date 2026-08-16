"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import type { EmailSettings, EmailProvider } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Mail, Save, Send, Server, Inbox } from "lucide-react";

export default function EmailSettingsPage() {
  const { activeWorkspace, isLoading: workspaceLoading } = useWorkspace();
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Sender identity
  const [provider, setProvider] = useState<EmailProvider>("resend");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [replyTo, setReplyTo] = useState("");

  // SMTP (outgoing)
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("465");
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [hasSmtpPassword, setHasSmtpPassword] = useState(false);

  // IMAP (incoming)
  const [imapEnabled, setImapEnabled] = useState(false);
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [imapSecure, setImapSecure] = useState(true);
  const [imapUsername, setImapUsername] = useState("");
  const [imapPassword, setImapPassword] = useState("");
  const [hasImapPassword, setHasImapPassword] = useState(false);

  // Test email
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Load existing settings
  useEffect(() => {
    if (!activeWorkspace) return;

    async function loadSettings() {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/email-settings?workspaceId=${activeWorkspace!.id}`
        );
        if (!res.ok) throw new Error("Failed to load email settings");
        const data = await res.json();

        const s = data.settings as (EmailSettings & { has_smtp_password?: boolean; has_imap_password?: boolean }) | null;
        if (s) {
          setSettings(s);
          setProvider(s.provider || "resend");
          setFromEmail(s.from_email || "");
          setFromName(s.from_name || "");
          setReplyTo(s.reply_to || "");

          setSmtpHost(s.smtp_host || "");
          setSmtpPort(s.smtp_port ? String(s.smtp_port) : "465");
          setSmtpSecure(s.smtp_secure ?? true);
          setSmtpUsername(s.smtp_username || "");
          setHasSmtpPassword(!!s.has_smtp_password);

          setImapEnabled(!!s.imap_enabled);
          setImapHost(s.imap_host || "");
          setImapPort(s.imap_port ? String(s.imap_port) : "993");
          setImapSecure(s.imap_secure ?? true);
          setImapUsername(s.imap_username || "");
          setHasImapPassword(!!s.has_imap_password);
        }
      } catch (err) {
        console.error("Error loading email settings:", err);
        setError("Failed to load email settings");
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [activeWorkspace]);

  function buildPayload() {
    const payload: Record<string, unknown> = {
      workspace_id: activeWorkspace!.id,
      provider,
      from_email: fromEmail.trim() || null,
      from_name: fromName.trim() || null,
      reply_to: replyTo.trim() || null,
      smtp_host: smtpHost.trim() || null,
      smtp_port: smtpPort ? Number(smtpPort) : null,
      smtp_secure: smtpSecure,
      smtp_username: smtpUsername.trim() || null,
      imap_enabled: imapEnabled,
      imap_host: imapHost.trim() || null,
      imap_port: imapPort ? Number(imapPort) : null,
      imap_secure: imapSecure,
      imap_username: imapUsername.trim() || null,
    };
    // Only send passwords when the user typed a new one.
    if (smtpPassword) payload.smtp_password = smtpPassword;
    if (imapPassword) payload.imap_password = imapPassword;
    return payload;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspace) return;

    setIsSaving(true);
    setError(null);
    setSuccess(false);
    setTestResult(null);

    try {
      const res = await fetch("/api/email-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save email settings");
      }

      const data = await res.json();
      const s = data.settings as (EmailSettings & { has_smtp_password?: boolean; has_imap_password?: boolean });
      setSettings(s);
      setHasSmtpPassword(!!s.has_smtp_password);
      setHasImapPassword(!!s.has_imap_password);
      // Clear the plaintext password fields — they're now saved (encrypted).
      setSmtpPassword("");
      setImapPassword("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving email settings:", err);
      setError(err instanceof Error ? err.message : "Failed to save email settings");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTest() {
    if (!activeWorkspace) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/email-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: activeWorkspace.id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Test email failed");
      }
      setTestResult({
        ok: true,
        msg: `Test email sent${data.to ? ` to ${data.to}` : ""}. Check your inbox.`,
      });
    } catch (err) {
      setTestResult({
        ok: false,
        msg: err instanceof Error ? err.message : "Test email failed",
      });
    } finally {
      setIsTesting(false);
    }
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Email Settings</h2>
        <p className="text-muted-foreground">
          Choose how this workspace sends and receives email.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Provider selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Sending Method
            </CardTitle>
            <CardDescription>
              Send through the built-in Lunenix mailer (Resend) or connect your own
              email account over SMTP (Gmail, Outlook, or any provider).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={provider} onValueChange={(v) => setProvider(v as EmailProvider)}>
                <SelectTrigger className="max-w-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resend">Built-in mailer (Resend)</SelectItem>
                  <SelectItem value="smtp">My own email account (SMTP)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Sender identity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Sender Identity
            </CardTitle>
            <CardDescription>
              The name and address recipients see. For SMTP this should match the
              account you connect below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="from_name">From Name</Label>
              <Input
                id="from_name"
                type="text"
                placeholder="Your Business Name"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="from_email">From Email</Label>
              <Input
                id="from_email"
                type="email"
                placeholder="hello@yourbusiness.com"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
              />
              {provider === "resend" ? (
                <p className="text-sm text-muted-foreground">
                  Must be verified in your Resend account. Leave blank to use the
                  platform default.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Usually the same as your SMTP username. Leave blank to use the
                  SMTP username as the from address.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reply_to">Reply-To Email (Optional)</Label>
              <Input
                id="reply_to"
                type="email"
                placeholder="support@yourbusiness.com"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* SMTP config */}
        {provider === "smtp" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Outgoing Mail Server (SMTP)
              </CardTitle>
              <CardDescription>
                Connection details for sending. For Gmail use{" "}
                <code className="bg-muted px-1 py-0.5 rounded">smtp.gmail.com</code>,
                port 465, and an{" "}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  App Password
                </a>{" "}
                (not your normal password).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtp_host">SMTP Host</Label>
                  <Input
                    id="smtp_host"
                    placeholder="smtp.gmail.com"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp_port">Port</Label>
                  <Input
                    id="smtp_port"
                    type="number"
                    placeholder="465"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="smtp_secure"
                  checked={smtpSecure}
                  onCheckedChange={(c) => setSmtpSecure(!!c)}
                />
                <Label htmlFor="smtp_secure" className="font-normal">
                  Use SSL/TLS (recommended — on for port 465, off for 587)
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp_username">Username</Label>
                <Input
                  id="smtp_username"
                  placeholder="you@gmail.com"
                  value={smtpUsername}
                  onChange={(e) => setSmtpUsername(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp_password">Password</Label>
                <Input
                  id="smtp_password"
                  type="password"
                  placeholder={hasSmtpPassword ? "•••••••• (leave blank to keep current)" : "App password or SMTP password"}
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                />
                {hasSmtpPassword && (
                  <p className="text-sm text-muted-foreground">
                    A password is saved. Leave blank to keep it, or type a new one to replace it.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* IMAP config */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              Incoming Mail (IMAP)
            </CardTitle>
            <CardDescription>
              Optionally pull received email into the in-app{" "}
              <strong>Inbox</strong>. This reads messages from your mailbox; it
              doesn&apos;t delete them from your provider.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="imap_enabled"
                checked={imapEnabled}
                onCheckedChange={(c) => setImapEnabled(!!c)}
              />
              <Label htmlFor="imap_enabled" className="font-normal">
                Enable inbox syncing
              </Label>
            </div>

            {imapEnabled && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="imap_host">IMAP Host</Label>
                    <Input
                      id="imap_host"
                      placeholder="imap.gmail.com"
                      value={imapHost}
                      onChange={(e) => setImapHost(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="imap_port">Port</Label>
                    <Input
                      id="imap_port"
                      type="number"
                      placeholder="993"
                      value={imapPort}
                      onChange={(e) => setImapPort(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="imap_secure"
                    checked={imapSecure}
                    onCheckedChange={(c) => setImapSecure(!!c)}
                  />
                  <Label htmlFor="imap_secure" className="font-normal">
                    Use SSL/TLS (recommended — on for port 993)
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="imap_username">Username</Label>
                  <Input
                    id="imap_username"
                    placeholder="you@gmail.com"
                    value={imapUsername}
                    onChange={(e) => setImapUsername(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="imap_password">Password</Label>
                  <Input
                    id="imap_password"
                    type="password"
                    placeholder={hasImapPassword ? "•••••••• (leave blank to keep current)" : "App password or IMAP password"}
                    value={imapPassword}
                    onChange={(e) => setImapPassword(e.target.value)}
                  />
                  {hasImapPassword && (
                    <p className="text-sm text-muted-foreground">
                      A password is saved. Leave blank to keep it, or type a new one to replace it.
                    </p>
                  )}
                </div>

                {settings?.imap_last_synced_at && (
                  <p className="text-sm text-muted-foreground">
                    Last synced: {new Date(settings.imap_last_synced_at).toLocaleString()}
                  </p>
                )}
                {settings?.imap_last_error && (
                  <p className="text-sm font-medium text-destructive">
                    Last sync error: {settings.imap_last_error}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        {success && (
          <p className="text-sm font-medium text-green-600">
            Email settings saved successfully!
          </p>
        )}
        {testResult && (
          <p
            className={`text-sm font-medium ${
              testResult.ok ? "text-green-600" : "text-destructive"
            }`}
          >
            {testResult.msg}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Settings
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleTest}
            disabled={isTesting || !settings}
            title={!settings ? "Save your settings first" : "Send yourself a test email"}
          >
            {isTesting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Send Test Email
          </Button>
        </div>
      </form>
    </div>
  );
}
