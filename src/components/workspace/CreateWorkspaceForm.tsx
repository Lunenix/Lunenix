"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IndustryVerticalFields } from "@/components/workspace/IndustryVerticalFields";
import {
  CUSTOM_INDUSTRY_PRESET,
  TEAM_SIZE_OPTIONS,
  TRIAL_DAYS,
} from "@/lib/workspace";
import { Building2, Loader2 } from "lucide-react";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface WorkspaceOnboardingFormProps {
  onCreated?: () => void;
}

export function WorkspaceOnboardingForm({
  onCreated,
}: WorkspaceOnboardingFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [industry, setIndustry] = useState("");
  const [industryCustom, setIndustryCustom] = useState("");
  const [teamSize, setTeamSize] = useState("1-5");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) {
      setError("Company name is required.");
      return;
    }
    if (!phone.trim()) {
      setError("Company phone is required.");
      return;
    }
    if (!logoFile) {
      setError("Upload your company logo.");
      return;
    }
    if (!industry) {
      setError("Choose an industry.");
      return;
    }
    if (industry === CUSTOM_INDUSTRY_PRESET && !industryCustom.trim()) {
      setError("Describe your business type for Other.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("name", name.trim());
      body.append("slug", slugify(name));
      body.append("phone", phone.trim());
      body.append("industry_preset", industry);
      if (industryCustom.trim()) {
        body.append("industry_custom_label", industryCustom.trim());
      }
      body.append("team_size", teamSize);
      body.append("logo", logoFile);
      const res = await fetch("/api/workspaces", {
        method: "POST",
        body,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create workspace");
      if (onCreated) onCreated();
      else window.location.assign("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Set up your company</CardTitle>
          <CardDescription>
            You have {TRIAL_DAYS} days free. Add your company name, logo, phone,
            industry, and team size. You can change the industry later in
            Workspace Management.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-center text-sm font-medium text-green-600 dark:text-green-400">
            {TRIAL_DAYS}-day free trial included
          </div>

          <div className="space-y-2">
            <Label htmlFor="ws-name">Company name</Label>
            <Input
              id="ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Events Co."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ws-logo">Company logo</Label>
            <Input
              id="ws-logo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              PNG, JPG, WebP, or GIF. Max 2 MB.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ws-phone">Company phone</Label>
            <Input
              id="ws-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(512) 555-0100"
              autoComplete="tel"
            />
          </div>

          <IndustryVerticalFields
            idPrefix="ws"
            value={industry}
            customLabel={industryCustom}
            onValueChange={setIndustry}
            onCustomLabelChange={setIndustryCustom}
          />

          <div className="space-y-2">
            <Label htmlFor="ws-team">Team size</Label>
            <Select value={teamSize} onValueChange={setTeamSize}>
              <SelectTrigger id="ws-team">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEAM_SIZE_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}

          <Button className="w-full" onClick={handleCreate} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create workspace
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function CreateWorkspaceForm() {
  return <WorkspaceOnboardingForm />;
}
