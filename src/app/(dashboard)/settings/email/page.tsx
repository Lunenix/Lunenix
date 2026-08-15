"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import type { EmailSettings } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Save } from "lucide-react";

export default function EmailSettingsPage() {
  const { activeWorkspace, isLoading: workspaceLoading } = useWorkspace();
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [replyTo, setReplyTo] = useState("");

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
        
        if (data.settings) {
          setSettings(data.settings);
          setFromEmail(data.settings.from_email);
          setFromName(data.settings.from_name);
          setReplyTo(data.settings.reply_to || "");
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspace) return;

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/email-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: activeWorkspace.id,
          from_email: fromEmail.trim(),
          from_name: fromName.trim(),
          reply_to: replyTo.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save email settings");
      }

      const data = await res.json();
      setSettings(data.settings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving email settings:", err);
      setError(err instanceof Error ? err.message : "Failed to save email settings");
    } finally {
      setIsSaving(false);
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
          Configure how emails sent from this workspace appear to recipients.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Sender Identity
          </CardTitle>
          <CardDescription>
            Set the name and email address that recipients will see when you send emails.
            All emails still send through your Resend account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="from_name">From Name</Label>
              <Input
                id="from_name"
                type="text"
                placeholder="Your Business Name"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                required
              />
              <p className="text-sm text-muted-foreground">
                The name that will appear in the recipient&apos;s inbox
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="from_email">From Email</Label>
              <Input
                id="from_email"
                type="email"
                placeholder="hello@yourbusiness.com"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                required
              />
              <p className="text-sm text-muted-foreground">
                Must be verified in your Resend account. Use <code className="bg-muted px-1 py-0.5 rounded">onboarding@resend.dev</code> for testing.
              </p>
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
              <p className="text-sm text-muted-foreground">
                If set, replies will go to this address instead of the from email
              </p>
            </div>

            {error && (
              <p className="text-sm font-medium text-destructive">{error}</p>
            )}

            {success && (
              <p className="text-sm font-medium text-green-500">
                Email settings saved successfully!
              </p>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {!isSaving && <Save className="mr-2 h-4 w-4" />}
                Save Settings
              </Button>
              {settings && !fromEmail && !fromName && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFromEmail(settings.from_email);
                    setFromName(settings.from_name);
                    setReplyTo(settings.reply_to || "");
                  }}
                >
                  Reset to Saved
                </Button>
              )}
            </div>

            {!settings && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>First time setup:</strong> If you leave these fields empty, emails will be sent from the platform default (<code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">Lunenix &lt;onboarding@resend.dev&gt;</code>). Configure your own sender identity to brand your emails.
                </p>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Domain Verification</CardTitle>
          <CardDescription>
            To send from your own domain (e.g., hello@yourbusiness.com):
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Log in to your Resend account</li>
            <li>Go to <strong>Domains</strong> in the sidebar</li>
            <li>Click <strong>Add Domain</strong> and enter your domain</li>
            <li>Add the DNS records shown to your domain registrar</li>
            <li>Wait for verification (usually a few minutes)</li>
            <li>Come back here and enter your email address above</li>
          </ol>
          <p className="mt-4 text-sm text-muted-foreground">
            💡 Tip: Use <code className="bg-muted px-1 py-0.5 rounded">onboarding@resend.dev</code> while testing—it works immediately without domain setup.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
