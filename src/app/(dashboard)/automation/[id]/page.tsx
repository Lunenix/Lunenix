"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { WorkflowBuilder } from "@/components/automation/WorkflowBuilder";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Trash2 } from "lucide-react";
import type {
  AutomationWorkflow,
  AutomationTriggerType,
  AutomationAction,
  EmailTemplate,
  Form,
} from "@/types/database";

export default function AutomationEditorPage({
  params,
}: {
  params: { id: string };
}) {
  const resolvedParams = params;
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState<AutomationTriggerType | "">("");
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>({});
  const [actions, setActions] = useState<AutomationAction[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const isNew = resolvedParams.id === "new";

  useEffect(() => {
    if (activeWorkspace) {
      fetchTemplates();
      fetchForms();
      if (!isNew) {
        fetchWorkflow();
      } else {
        setIsLoading(false);
      }
    }
  }, [resolvedParams.id, activeWorkspace, isNew]);

  const fetchWorkflow = async () => {
    try {
      const response = await fetch(`/api/automation-workflows/${resolvedParams.id}`);
      const data = await response.json();
      const workflow: AutomationWorkflow = data.workflow;
      setName(workflow.name);
      setDescription(workflow.description || "");
      setTriggerType(workflow.trigger_type);
      setTriggerConfig(workflow.trigger_config);
      setActions(workflow.actions);
    } catch (error) {
      console.error("Error fetching workflow:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTemplates = async () => {
    if (!activeWorkspace) return;

    try {
      const response = await fetch(
        `/api/email-templates?workspaceId=${activeWorkspace.id}`
      );
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  };

  const fetchForms = async () => {
    if (!activeWorkspace) return;

    try {
      const response = await fetch(`/api/forms?workspaceId=${activeWorkspace.id}`);
      const data = await response.json();
      setForms(data.forms || []);
    } catch (error) {
      console.error("Error fetching forms:", error);
    }
  };

  const handleSave = async () => {
    if (!activeWorkspace || !name || !triggerType || actions.length === 0) {
      alert("Please fill in all required fields and add at least one action");
      return;
    }

    setIsSaving(true);

    try {
      const url = isNew
        ? "/api/automation-workflows"
        : `/api/automation-workflows/${resolvedParams.id}`;
      const method = isNew ? "POST" : "PATCH";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: activeWorkspace.id,
          name,
          description,
          trigger_type: triggerType,
          trigger_config: triggerConfig,
          actions,
          is_active: false, // Workflows start inactive by default
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save workflow");
      }

      router.push("/automation");
    } catch (error) {
      console.error("Error saving workflow:", error);
      alert("Failed to save workflow. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this workflow?")) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/automation-workflows/${resolvedParams.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete workflow");
      }

      router.push("/automation");
    } catch (error) {
      console.error("Error deleting workflow:", error);
      alert("Failed to delete workflow. Please try again.");
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
            {isNew ? "New Automation Workflow" : "Edit Workflow"}
          </h1>
          <p className="text-muted-foreground">
            Configure triggers and actions to automate your processes
          </p>
        </div>
        <div className="flex gap-2">
          {!isNew && (
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
                Save Workflow
              </>
            )}
          </Button>
        </div>
      </div>

      <WorkflowBuilder
        name={name}
        description={description}
        triggerType={triggerType}
        triggerConfig={triggerConfig}
        actions={actions}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        onTriggerTypeChange={setTriggerType}
        onTriggerConfigChange={setTriggerConfig}
        onActionsChange={setActions}
        templates={templates}
        forms={forms}
      />
    </div>
  );
}
