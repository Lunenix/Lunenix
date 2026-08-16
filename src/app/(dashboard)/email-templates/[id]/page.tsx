"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { EmailTemplateEditor } from "@/components/emails/EmailTemplateEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Save, Trash2 } from "lucide-react";
import type { EmailTemplate } from "@/types/database";

export default function EmailTemplateEditorPage({
  params,
}: {
  params: { id: string };
}) {
  const resolvedParams = params;
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSystemDefault, setIsSystemDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const isNew = resolvedParams.id === "new";

  useEffect(() => {
    if (!isNew && activeWorkspace) {
      fetchTemplate();
    } else {
      setIsLoading(false);
    }
  }, [resolvedParams.id, activeWorkspace, isNew]);

  const fetchTemplate = async () => {
    try {
      const response = await fetch(`/api/email-templates/${resolvedParams.id}`);
      const data = await response.json();
      const template: EmailTemplate = data.template;
      setName(template.name);
      setSubject(template.subject);
      setBody(template.body);
      setIsSystemDefault(Boolean(template.is_system_default));
    } catch (error) {
      console.error("Error fetching template:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!activeWorkspace || !name || !subject || !body) {
      alert("Please fill in all required fields");
      return;
    }

    setIsSaving(true);

    try {
      const url = isNew
        ? "/api/email-templates"
        : `/api/email-templates/${resolvedParams.id}`;
      const method = isNew ? "POST" : "PATCH";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: activeWorkspace.id,
          name,
          subject,
          body,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save template");
      }

      router.push("/email-templates");
    } catch (error) {
      console.error("Error saving template:", error);
      alert("Failed to save template. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this template?")) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/email-templates/${resolvedParams.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete template");
      }

      router.push("/email-templates");
    } catch (error) {
      console.error("Error deleting template:", error);
      alert("Failed to delete template. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {isNew ? "New Email Template" : "Edit Template"}
          </h1>
          <p className="text-muted-foreground">
            Create reusable email templates with dynamic variables
          </p>
        </div>
        <div className="flex gap-2">
          {!isNew && !isSystemDefault && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </Button>
          )}
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Template
              </>
            )}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <EmailTemplateEditor
            name={name}
            subject={subject}
            body={body}
            isSystemDefault={isSystemDefault}
            onNameChange={setName}
            onSubjectChange={setSubject}
            onBodyChange={setBody}
          />
        </CardContent>
      </Card>
    </div>
  );
}
