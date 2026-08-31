"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Send, Eye, Paperclip, X, Clock, AlertTriangle } from "lucide-react";
import type { Contact, EmailTemplate } from "@/types/database";
import { contactDisplayName } from "@/types/database";

interface SmartWarning {
  key: string;
  message: string;
}

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  contact?: Contact | null;
  templates: EmailTemplate[];
  onSent?: () => void;
  /** Context for smart-field resolution. */
  projectId?: string | null;
  invoiceId?: string | null;
  contractId?: string | null;
  formId?: string | null;
  /**
   * Pre-fill the composer (e.g. when replying to an inbound email). When
   * provided, the recipient field stays editable even if a contact is linked.
   */
  prefill?: {
    to?: string;
    toName?: string;
    subject?: string;
    body?: string;
  } | null;
}

export function SendEmailDialog({
  open,
  onOpenChange,
  workspaceId,
  contact,
  templates,
  onSent,
  projectId = null,
  invoiceId = null,
  contractId = null,
  formId = null,
  prefill,
}: SendEmailDialogProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<
    { filename: string; content: string; size: number }[]
  >([]);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [appendSignature, setAppendSignature] = useState(true);

  const [isSending, setIsSending] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  const [warnings, setWarnings] = useState<SmartWarning[]>([]);

  useEffect(() => {
    if (!open) return;
    setSelectedTemplateId("");
    setRecipientEmail(prefill?.to ?? contact?.email ?? "");
    setRecipientName(prefill?.toName ?? (contact ? contactDisplayName(contact) : ""));
    setSubject(prefill?.subject ?? "");
    setBody(prefill?.body ?? "");
    setAttachments([]);
    setScheduleEnabled(false);
    setScheduledFor("");
    setAppendSignature(true);
    setPreview(null);
    setWarnings([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      // Keep raw tokens — they resolve server-side against live data.
      setSubject(template.subject);
      setBody(template.body);
      setPreview(null);
      setWarnings([]);
    }
  };

  const contextPayload = () => ({
    workspace_id: workspaceId,
    contact_id: contact?.id || null,
    project_id: projectId,
    invoice_id: invoiceId,
    contract_id: contractId,
    form_id: formId,
    template_id: selectedTemplateId || null,
    recipient_email: recipientEmail,
    recipient_name: recipientName || null,
    subject,
    body,
    append_signature: appendSignature,
    attachments: attachments.map((a) => ({ filename: a.filename, content: a.content })),
  });

  const handlePreview = async () => {
    setIsPreviewing(true);
    setPreview(null);
    try {
      const res = await fetch("/api/emails/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...contextPayload(), dry_run: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview failed");
      setPreview(data.resolved);
      setWarnings(data.warnings || []);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1] || "";
        setAttachments((prev) => [
          ...prev,
          { filename: file.name, content: base64, size: file.size },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSend = async () => {
    if (!recipientEmail || !subject || !body) {
      alert("Please fill in recipient, subject and message.");
      return;
    }
    if (scheduleEnabled && !scheduledFor) {
      alert("Please pick a date/time to schedule, or turn off scheduling.");
      return;
    }
    setIsSending(true);
    try {
      const payload: Record<string, unknown> = { ...contextPayload() };
      if (scheduleEnabled && scheduledFor) {
        payload.scheduled_for = new Date(scheduledFor).toISOString();
      }
      const res = await fetch("/api/emails/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      onOpenChange(false);
      onSent?.();
      if (data.scheduled) {
        alert("Email scheduled successfully.");
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  const formatBytes = (n: number) =>
    n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Email</DialogTitle>
          <DialogDescription>
            Compose and send an email{contact ? ` to ${contactDisplayName(contact)}` : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {templates.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="template">Use a template (optional)</Label>
              <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                <SelectTrigger id="template">
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="recipient-email">
                Recipient email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="recipient-email"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="contact@example.com"
                disabled={!!contact?.email && !prefill}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipient-name">Recipient name</Label>
              <Input
                id="recipient-name"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">
              Subject <span className="text-destructive">*</span>
            </Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject... {{smart fields}} supported"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">
              Message <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email message here... HTML and {{smart fields}} supported."
              rows={10}
            />
            <p className="text-xs text-muted-foreground">
              Smart fields like <code className="rounded bg-muted px-1">{"{{client.first_name}}"}</code>{" "}
              resolve to live data when sent. Use Preview to check them.
            </p>
          </div>

          {/* Attachments (manual sends only — never saved to the template) */}
          <div className="space-y-2">
            <Label>Attachments</Label>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent">
                <Paperclip className="h-4 w-4" />
                Add files
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </label>
              {attachments.map((a, i) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  {a.filename} ({formatBytes(a.size)})
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                    className="ml-1 rounded-full hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Signature toggle */}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={appendSignature}
              onChange={(e) => setAppendSignature(e.target.checked)}
            />
            Append my default signature
          </label>

          {/* Schedule */}
          <div className="space-y-2 rounded-md border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={scheduleEnabled}
                onChange={(e) => setScheduleEnabled(e.target.checked)}
              />
              <Clock className="h-4 w-4" /> Schedule for later
            </label>
            {scheduleEnabled && (
              <Input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="max-w-xs"
              />
            )}
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950">
              <div className="mb-1 flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" />
                {warnings.length} smart field{warnings.length > 1 ? "s" : ""} could not be resolved
              </div>
              <ul className="list-inside list-disc text-amber-700 dark:text-amber-400">
                {warnings.map((w, i) => (
                  <li key={i}>{w.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="space-y-2 rounded-md border p-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                Preview
              </div>
              <div className="text-sm font-medium">{preview.subject}</div>
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: preview.body }}
              />
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={handlePreview} disabled={isPreviewing || isSending}>
            {isPreviewing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            Preview
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={isSending}>
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {scheduleEnabled ? "Scheduling..." : "Sending..."}
                </>
              ) : (
                <>
                  {scheduleEnabled ? (
                    <Clock className="mr-2 h-4 w-4" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  {scheduleEnabled ? "Schedule" : "Send Email"}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
