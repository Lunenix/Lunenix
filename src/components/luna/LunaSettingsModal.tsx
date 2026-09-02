"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/lib/toast";
import {
  LUNA_TIMEZONES,
  ensureVoicesLoaded,
  pickFemaleVoice,
} from "@/lib/luna";
import type { WorkspaceAISettings } from "@/types/database";
import { LunaAvatar } from "./LunaAvatar";
import { Loader2, Volume2, MapPin } from "lucide-react";

interface LunaSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  settings: WorkspaceAISettings | null;
  /** Whether the current user is a super-admin (sees the real Luna portrait). */
  isAdmin?: boolean;
  onSaved: (settings: WorkspaceAISettings) => void;
}

export function LunaSettingsModal({
  open,
  onOpenChange,
  workspaceId,
  settings,
  isAdmin = false,
  onSaved,
}: LunaSettingsModalProps) {
  const [agentName, setAgentName] = useState("Luna");
  const [homeCity, setHomeCity] = useState("");
  const [timezone, setTimezone] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  // Sync local form state whenever the modal opens or the settings change.
  useEffect(() => {
    if (open && settings) {
      setAgentName(settings.agent_name || "Luna");
      setHomeCity(settings.home_city || "");
      setTimezone(
        settings.timezone ||
          (typeof Intl !== "undefined"
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : "")
      );
      setCustomInstructions(settings.custom_instructions || "");
    }
  }, [open, settings]);

  const playVoicePreview = async (previewText: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Voice preview is not supported in this browser.");
      return;
    }
    const synth = window.speechSynthesis;
    const voices = await ensureVoicesLoaded();
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(previewText);
    const femaleVoice = pickFemaleVoice(voices);
    if (femaleVoice) utterance.voice = femaleVoice;
    utterance.pitch = 1.15;
    utterance.rate = 0.92;
    utterance.onstart = () => setIsPreviewing(true);
    utterance.onend = () => setIsPreviewing(false);
    utterance.onerror = () => setIsPreviewing(false);
    synth.speak(utterance);
  };

  const detectFromDevice = () => {
    const tz =
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "";
    if (tz) setTimezone(tz);
    if (!navigator.geolocation) {
      toast("Location isn't available in this browser. Time zone was filled.", "info");
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `/api/geo/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Lookup failed");
          if (typeof data.city === "string") setHomeCity(data.city);
          if (typeof data.timezone === "string" && data.timezone) {
            setTimezone(data.timezone);
          }
          toast("City and time zone filled from this device.", "success");
        } catch (e) {
          toast(
            e instanceof Error ? e.message : "Could not detect city.",
            "error"
          );
        } finally {
          setDetecting(false);
        }
      },
      () => {
        setDetecting(false);
        toast(
          "Location permission denied. Time zone was still filled from this device.",
          "info"
        );
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const handleSave = async () => {
    if (!agentName.trim()) {
      toast("Agent name is required", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/workspaces/ai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          agent_name: agentName.trim(),
          avatar_id: "luna",
          voice_id: "ava",
          home_city: homeCity.trim() || null,
          timezone: timezone.trim() || null,
          custom_instructions: customInstructions.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save settings");
      }
      const data = await res.json();
      toast("Assistant settings saved!", "success");
      onSaved(data.settings);
      onOpenChange(false);
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "Failed to save settings",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Customize Your Executive Assistant</DialogTitle>
          <DialogDescription>
            Set a name, home city, and time zone. Custom instructions are
            optional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Agent Name */}
          <div className="space-y-2">
            <Label htmlFor="agent-name">Agent Name</Label>
            <Input
              id="agent-name"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Luna"
            />
          </div>

          <div className="space-y-2">
            <Label>Avatar and voice</Label>
            <div className="flex items-center gap-4 rounded-lg border border-border p-4">
              <LunaAvatar
                isSpeaking={isPreviewing}
                isAdmin={isAdmin}
                size={72}
                className="shrink-0"
              />
              <div className="min-w-0 flex-1 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">
                  {agentName.trim() || "Luna"}
                </p>
                <p className="mt-0.5 text-xs">
                  Luna uses one voice. Preview it with the speaker.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  playVoicePreview(
                    `Hello, I'm ${agentName.trim() || "Luna"}, your executive assistant. How can I help you today?`
                  );
                }}
                aria-label="Preview voice"
              >
                <Volume2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="home-city">Home city</Label>
            <Input
              id="home-city"
              value={homeCity}
              onChange={(e) => setHomeCity(e.target.value)}
              placeholder="Austin, Texas"
            />
            <p className="text-xs text-muted-foreground">
              Luna uses this for weather and &quot;here&quot; unless you name
              another city.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Time zone</Label>
            <Select value={timezone || undefined} onValueChange={setTimezone}>
              <SelectTrigger id="timezone">
                <SelectValue placeholder="Select a time zone" />
              </SelectTrigger>
              <SelectContent>
                {Array.from(
                  new Set([
                    timezone,
                    ...LUNA_TIMEZONES,
                  ].filter(Boolean))
                ).map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-instructions">
              Custom instructions{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="custom-instructions"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value.slice(0, 1500))}
              placeholder="Leave blank, or add style notes such as keep answers short."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              You can save without this. Style and tone only — cannot override
              security or tenant isolation.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={detectFromDevice}
            disabled={detecting}
          >
            {detecting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <MapPin className="mr-2 h-4 w-4" />
            )}
            Use my current location
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
