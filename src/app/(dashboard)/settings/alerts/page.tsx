"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bell, Loader2, Save } from "lucide-react";

export default function AlertSettingsPage() {
  const [phone, setPhone] = useState("");
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/user-settings");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load settings");
        if (cancelled) return;
        setPhone(data.settings?.personal_phone_number ?? "");
        setSmsEnabled(data.settings?.sms_enabled !== false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load settings");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/user-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personal_phone_number: phone.trim() || null,
          sms_enabled: smsEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setPhone(data.settings?.personal_phone_number ?? "");
      setSmsEnabled(data.settings?.sms_enabled !== false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Alerts</h2>
        <p className="text-muted-foreground">
          Your personal phone and SMS preferences. These are not shared with other
          workspace members.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              SMS channel
            </CardTitle>
            <CardDescription>
              Store a number for future SMS alerts. Luna never reads the full number
              into workspace context.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 max-w-sm">
              <Label htmlFor="personal_phone_number">Personal phone</Label>
              <Input
                id="personal_phone_number"
                type="tel"
                autoComplete="tel"
                placeholder="+15551234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={smsEnabled}
                onCheckedChange={(v) => setSmsEnabled(v === true)}
              />
              Enable SMS alerts
            </label>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {success ? (
              <p className="text-sm text-muted-foreground">Saved.</p>
            ) : null}
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
