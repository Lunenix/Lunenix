"use client";

import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmailBodyEditor } from "@/components/emails/EmailBodyEditor";
import { SmartFieldPicker } from "@/components/emails/SmartFieldPicker";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Lock } from "lucide-react";

interface EmailTemplateEditorProps {
  name: string;
  subject: string;
  body: string;
  onNameChange: (name: string) => void;
  onSubjectChange: (subject: string) => void;
  onBodyChange: (body: string) => void;
  /** When true, show a "system default" note (still editable, not deletable). */
  isSystemDefault?: boolean;
}

export function EmailTemplateEditor({
  name,
  subject,
  body,
  onNameChange,
  onSubjectChange,
  onBodyChange,
  isSystemDefault = false,
}: EmailTemplateEditorProps) {
  const subjectRef = useRef<HTMLInputElement>(null);

  // Insert a token into the subject input at the caret position.
  const insertIntoSubject = (token: string) => {
    const el = subjectRef.current;
    if (!el) {
      onSubjectChange(subject + token);
      return;
    }
    const start = el.selectionStart ?? subject.length;
    const end = el.selectionEnd ?? subject.length;
    const next = subject.slice(0, start) + token + subject.slice(end);
    onSubjectChange(next);
    // restore caret after React updates
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="space-y-6">
      {isSystemDefault && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          <Lock className="h-4 w-4 shrink-0" />
          <span>
            This is a <strong>system default</strong> template used by
            automations. You can edit it, but it cannot be deleted.
          </span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="template-name">Template title (internal label)</Label>
        <Input
          id="template-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Invoice Sent — friendly reminder"
        />
        <p className="text-xs text-muted-foreground">
          Only you see this. Tip: prefix related templates (e.g.
          &ldquo;Invoice — …&rdquo;, &ldquo;Onboarding — …&rdquo;) so search
          groups them together.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="subject">Subject line</Label>
          <SmartFieldPicker onInsert={(token) => insertIntoSubject(token)} />
        </div>
        <Input
          id="subject"
          ref={subjectRef}
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="e.g. Your invoice {{invoice.number}} from {{workspace.name}}"
        />
      </div>

      <div className="space-y-2">
        <Label>Email body</Label>
        <EmailBodyEditor content={body} onChange={onBodyChange} />
        <p className="text-xs text-muted-foreground">
          Use the{" "}
          <Badge variant="outline" className="font-mono text-[10px]">
            {"{ }"}
          </Badge>{" "}
          smart-field button to insert live data. Action fields (contract,
          invoice, form, scheduler) insert a clickable button — edit its text
          right in the token, e.g.{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
            {"{{contract.link|Review & Sign}}"}
          </code>
          .
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">How smart fields resolve</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-xs text-muted-foreground">
          <p>• Tokens are replaced with live data when the email is sent.</p>
          <p>
            • If data is missing, that spot shows a visible warning (never a
            silent blank) so you can catch it before sending.
          </p>
          <p>
            • Action buttons link to the specific project&rsquo;s contract,
            invoice, form, or your scheduling page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
