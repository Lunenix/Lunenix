"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/lib/toast";
import { contactDisplayName, type Contact } from "@/types/database";
import { Loader2 } from "lucide-react";

export type SendTextTarget = {
  workspaceId: string;
  contactId?: string | null;
  contactLabel?: string | null;
  defaultBody?: string;
};

export function SendTextDialog({
  open,
  onOpenChange,
  workspaceId,
  contactId,
  contactLabel,
  contacts,
  defaultBody,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  contactId?: string | null;
  contactLabel?: string | null;
  contacts?: Contact[];
  defaultBody?: string;
}) {
  const [pickedId, setPickedId] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const resolvedId = contactId || pickedId || "";
  const resolvedLabel = useMemo(() => {
    if (contactLabel) return contactLabel;
    const match = contacts?.find((c) => c.id === resolvedId);
    return match ? contactDisplayName(match) : "this contact";
  }, [contactLabel, contacts, resolvedId]);

  useEffect(() => {
    if (!open) return;
    setPickedId(contactId ?? "");
    setBody(defaultBody ?? "");
  }, [open, contactId, defaultBody]);

  async function send() {
    if (!resolvedId || !body.trim()) return;
    setSending(true);
    const res = await fetch("/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: workspaceId,
        contact_id: resolvedId,
        body: body.trim(),
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) {
      toast(json.error ?? "Could not send that text.", "error");
      return;
    }
    toast("Text sent.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send text</DialogTitle>
          <DialogDescription>
            Sends on Telegram to {resolvedLabel}. They must already have opened
            this workspace bot.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {!contactId ? (
            <div className="space-y-2">
              <Label>Contact</Label>
              <Select value={pickedId || "none"} onValueChange={(v) => setPickedId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select contact" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select contact</SelectItem>
                  {(contacts ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {contactDisplayName(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="send-text-body">Message</Label>
            <Textarea
              id="send-text-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Write a text…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={send} disabled={sending || !resolvedId || !body.trim()}>
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useSendText() {
  const [target, setTarget] = useState<SendTextTarget | null>(null);
  return {
    target,
    open: Boolean(target),
    openSendText: (next: SendTextTarget) => setTarget(next),
    closeSendText: () => setTarget(null),
  };
}
