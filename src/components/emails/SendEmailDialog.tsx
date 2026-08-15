"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Send } from "lucide-react";
import type { Contact, EmailTemplate } from "@/types/database";
import { contactDisplayName } from "@/types/database";

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  contact?: Contact | null;
  templates: EmailTemplate[];
  onSent?: () => void;
}

export function SendEmailDialog({
  open,
  onOpenChange,
  workspaceId,
  contact,
  templates,
  onSent,
}: SendEmailDialogProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [recipientEmail, setRecipientEmail] = useState(contact?.email || "");
  const [recipientName, setRecipientName] = useState(
    contact ? contactDisplayName(contact) : ""
  );
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSubject(replaceVariables(template.subject));
      setBody(replaceVariables(template.body));
    }
  };

  const replaceVariables = (text: string): string => {
    if (!contact) return text;

    let result = text;
    result = result.replace(/\{\{contact\.name\}\}/g, contactDisplayName(contact));
    result = result.replace(/\{\{contact\.first_name\}\}/g, contact.first_name || "");
    result = result.replace(/\{\{contact\.last_name\}\}/g, contact.last_name || "");
    result = result.replace(/\{\{contact\.email\}\}/g, contact.email || "");
    result = result.replace(/\{\{contact\.phone\}\}/g, contact.phone || "");
    result = result.replace(
      /\{\{contact\.organization\}\}/g,
      contact.organization_name || ""
    );
    // Add more variable replacements as needed
    return result;
  };

  const handleSend = async () => {
    if (!recipientEmail || !subject || !body) {
      alert("Please fill in all required fields");
      return;
    }

    setIsSending(true);

    try {
      const response = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          contact_id: contact?.id || null,
          template_id: selectedTemplateId || null,
          recipient_email: recipientEmail,
          recipient_name: recipientName || null,
          subject,
          body,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send email");
      }

      // Reset form
      setSelectedTemplateId("");
      setRecipientEmail("");
      setRecipientName("");
      setSubject("");
      setBody("");
      onOpenChange(false);
      onSent?.();
    } catch (error) {
      console.error("Error sending email:", error);
      alert("Failed to send email. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

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
          {/* Template Selector */}
          {templates.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="template">Use a Template (Optional)</Label>
              <Select
                value={selectedTemplateId}
                onValueChange={handleTemplateSelect}
              >
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

          {/* Recipient Details */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="recipient-email">
                Recipient Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="recipient-email"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="contact@example.com"
                disabled={!!contact?.email}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipient-name">Recipient Name</Label>
              <Input
                id="recipient-name"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">
              Subject <span className="text-destructive">*</span>
            </Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label htmlFor="body">
              Message <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email message here..."
              rows={12}
            />
            <p className="text-xs text-muted-foreground">
              HTML formatting is supported.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending}>
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Email
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
