"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TemplateVariable } from "@/types/database";

interface EmailTemplateEditorProps {
  name: string;
  subject: string;
  body: string;
  variables: TemplateVariable[];
  onNameChange: (name: string) => void;
  onSubjectChange: (subject: string) => void;
  onBodyChange: (body: string) => void;
}

// Pre-defined variables that are always available
const DEFAULT_VARIABLES: TemplateVariable[] = [
  {
    key: "contact.name",
    label: "Contact Name",
    description: "Full name of the contact",
  },
  {
    key: "contact.first_name",
    label: "First Name",
    description: "Contact's first name",
  },
  {
    key: "contact.last_name",
    label: "Last Name",
    description: "Contact's last name",
  },
  {
    key: "contact.email",
    label: "Email",
    description: "Contact's email address",
  },
  {
    key: "contact.phone",
    label: "Phone",
    description: "Contact's phone number",
  },
  {
    key: "contact.organization",
    label: "Organization",
    description: "Contact's organization name",
  },
  {
    key: "workspace.name",
    label: "Workspace Name",
    description: "Your workspace name",
  },
  {
    key: "user.name",
    label: "Your Name",
    description: "Your full name",
  },
];

export function EmailTemplateEditor({
  name,
  subject,
  body,
  variables,
  onNameChange,
  onSubjectChange,
  onBodyChange,
}: EmailTemplateEditorProps) {
  const insertVariable = (variableKey: string) => {
    const variableTag = `{{${variableKey}}}`;
    onBodyChange(body + variableTag);
  };

  const allVariables = [...DEFAULT_VARIABLES, ...variables];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main Editor */}
      <div className="lg:col-span-2 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="template-name">Template Name</Label>
          <Input
            id="template-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Welcome Email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="subject">Subject Line</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            placeholder="e.g. Welcome to {{workspace.name}}, {{contact.first_name}}!"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="body">Email Body</Label>
          <Textarea
            id="body"
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            placeholder="Write your email content here. Use {{variable}} syntax to insert dynamic content."
            rows={15}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            This template supports HTML. Use variables like{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">
              {"{{contact.name}}"}
            </code>{" "}
            to insert dynamic content.
          </p>
        </div>
      </div>

      {/* Variables Sidebar */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Available Variables</CardTitle>
            <CardDescription>
              Click to insert into your template
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {allVariables.map((variable) => (
              <button
                key={variable.key}
                onClick={() => insertVariable(variable.key)}
                className="w-full text-left p-2 rounded-md hover:bg-accent transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm group-hover:text-primary">
                      {variable.label}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {variable.description}
                    </div>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="mt-1 text-xs font-mono"
                >
                  {"{{" + variable.key + "}}"}
                </Badge>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Preview Tips</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              • Variables are replaced with actual data when sending emails
            </p>
            <p>• HTML formatting is supported in the email body</p>
            <p>
              • Use <code className="text-xs bg-muted px-1 py-0.5 rounded">{"<p>"}</code>,{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">{"<strong>"}</code>,{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">{"<a>"}</code> tags for
              formatting
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
