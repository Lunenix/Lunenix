"use client";

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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus, Trash2, Zap } from "lucide-react";
import type {
  AutomationTriggerType,
  AutomationActionType,
  AutomationAction,
  EmailTemplate,
  Form,
} from "@/types/database";

interface WorkflowBuilderProps {
  name: string;
  description: string;
  triggerType: AutomationTriggerType | "";
  triggerConfig: Record<string, unknown>;
  actions: AutomationAction[];
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onTriggerTypeChange: (type: AutomationTriggerType) => void;
  onTriggerConfigChange: (config: Record<string, unknown>) => void;
  onActionsChange: (actions: AutomationAction[]) => void;
  templates?: EmailTemplate[];
  forms?: Form[];
}

const TRIGGER_OPTIONS: { value: AutomationTriggerType; label: string }[] = [
  { value: "form_submission", label: "Form Submission" },
  { value: "lead_stage_change", label: "Lead Stage Change" },
  { value: "contact_created", label: "Contact Created" },
  { value: "task_completed", label: "Task Completed" },
  { value: "invoice_sent", label: "Invoice Sent" },
  { value: "contract_signed", label: "Contract Signed" },
];

const ACTION_OPTIONS: { value: AutomationActionType; label: string }[] = [
  { value: "send_email", label: "Send Email" },
  { value: "send_telegram", label: "Send Text" },
  { value: "create_task", label: "Create Task" },
  { value: "update_contact", label: "Update Contact" },
  { value: "move_lead", label: "Move Lead" },
  { value: "delay", label: "Delay" },
];

export function WorkflowBuilder({
  name,
  description,
  triggerType,
  triggerConfig,
  actions,
  onNameChange,
  onDescriptionChange,
  onTriggerTypeChange,
  onTriggerConfigChange,
  onActionsChange,
  templates = [],
  forms = [],
}: WorkflowBuilderProps) {
  // Choice-type fields of the currently selected form, used to let the user
  // trigger only when the client picks a specific dropdown/radio/checkbox answer.
  const CHOICE_TYPES = ["select", "radio", "checkbox"];
  const selectedFormId = (triggerConfig.form_id as string) || "";
  const selectedForm = forms.find((f) => f.id === selectedFormId);
  const choiceFields = (selectedForm?.fields || []).filter((f) =>
    CHOICE_TYPES.includes(f.type)
  );
  const selectedFieldId = (triggerConfig.field_id as string) || "";
  const selectedField = choiceFields.find((f) => f.id === selectedFieldId);

  const ANY = "__any__";

  const addAction = () => {
    onActionsChange([
      ...actions,
      { type: "send_email", config: {} },
    ]);
  };

  const removeAction = (index: number) => {
    onActionsChange(actions.filter((_, i) => i !== index));
  };

  const updateAction = (index: number, updatedAction: AutomationAction) => {
    onActionsChange(
      actions.map((action, i) => (i === index ? updatedAction : action))
    );
  };

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow Details</CardTitle>
          <CardDescription>
            Give your automation workflow a name and description
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workflow-name">Name</Label>
            <Input
              id="workflow-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. Welcome new contacts"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="workflow-description">Description</Label>
            <Textarea
              id="workflow-description"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Describe what this workflow does..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Trigger Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            When this happens...
          </CardTitle>
          <CardDescription>Choose the event that triggers this workflow</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="trigger-type">Trigger Event</Label>
            <Select
              value={triggerType}
              onValueChange={(value) =>
                onTriggerTypeChange(value as AutomationTriggerType)
              }
            >
              <SelectTrigger id="trigger-type">
                <SelectValue placeholder="Select a trigger..." />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Form-specific trigger config */}
          {triggerType === "form_submission" && forms.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="form-id">Specific Form (Optional)</Label>
              <Select
                value={selectedFormId || ANY}
                onValueChange={(value) => {
                  // Changing the form invalidates any previously chosen field
                  // condition (field IDs are per-form), so reset it.
                  if (value === ANY) {
                    onTriggerConfigChange({});
                  } else {
                    onTriggerConfigChange({ form_id: value });
                  }
                }}
              >
                <SelectTrigger id="form-id">
                  <SelectValue placeholder="Any form" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any form</SelectItem>
                  {forms.map((form) => (
                    <SelectItem key={form.id} value={form.id}>
                      {form.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Answer condition: only run when a specific choice is picked */}
          {triggerType === "form_submission" &&
            selectedForm &&
            choiceFields.length > 0 && (
              <div className="space-y-4 rounded-md border border-dashed p-4">
                <div className="space-y-2">
                  <Label htmlFor="condition-field">
                    Only when a specific answer is chosen (optional)
                  </Label>
                  <Select
                    value={selectedFieldId || ANY}
                    onValueChange={(value) => {
                      if (value === ANY) {
                        // Drop the field condition, keep the form filter.
                        onTriggerConfigChange({ form_id: selectedFormId });
                      } else {
                        const field = choiceFields.find((f) => f.id === value);
                        onTriggerConfigChange({
                          form_id: selectedFormId,
                          field_id: value,
                          field_label: field?.label ?? null,
                          operator: "equals",
                          value: "",
                        });
                      }
                    }}
                  >
                    <SelectTrigger id="condition-field">
                      <SelectValue placeholder="Any answer (run on every submission)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>
                        Any answer (run on every submission)
                      </SelectItem>
                      {choiceFields.map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Pick a dropdown / multiple-choice question to run this
                    workflow only when the client selects a particular option.
                  </p>
                </div>

                {selectedField && (
                  <div className="space-y-2">
                    <Label htmlFor="condition-value">
                      When the answer is
                    </Label>
                    <Select
                      value={(triggerConfig.value as string) || ANY}
                      onValueChange={(value) =>
                        onTriggerConfigChange({
                          ...triggerConfig,
                          operator: value === ANY ? "any" : "equals",
                          value: value === ANY ? "" : value,
                        })
                      }
                    >
                      <SelectTrigger id="condition-value">
                        <SelectValue placeholder="Choose an option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ANY}>Any option (just answered)</SelectItem>
                        {(selectedField.options || []).map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Do these actions...</CardTitle>
          <CardDescription>
            Configure the actions to perform when the trigger fires
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {actions.map((action, index) => (
            <Card key={index} className="border-dashed">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-4">
                    <div className="space-y-2">
                      <Label>Action {index + 1}</Label>
                      <Select
                        value={action.type}
                        onValueChange={(value) =>
                          updateAction(index, {
                            ...action,
                            type: value as AutomationActionType,
                            config: {},
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACTION_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Action-specific configuration */}
                    {action.type === "send_telegram" && (
                      <div className="space-y-2">
                        <Label>Text message</Label>
                        <Textarea
                          value={(action.config.body as string) || ""}
                          onChange={(e) =>
                            updateAction(index, {
                              ...action,
                              config: { ...action.config, body: e.target.value },
                            })
                          }
                          placeholder="Hi {{contact.name}}, your estimate is ready."
                          rows={4}
                        />
                        <p className="text-xs text-muted-foreground">
                          Sends on Telegram to the contact on this trigger. Use
                          {" "}
                          <code className="text-[11px]">{"{{contact.name}}"}</code>
                          . They must already have opened the workspace bot.
                        </p>
                      </div>
                    )}

                    {action.type === "send_email" && (
                      <div className="space-y-2">
                        <Label>Email Template</Label>
                        <Select
                          value={(action.config.template_id as string) || ""}
                          onValueChange={(value) => {
                            // Snapshot the template's current content into the
                            // step so later edits to the master template don't
                            // retroactively change this placed step.
                            const tpl = templates.find((t) => t.id === value);
                            updateAction(index, {
                              ...action,
                              config: {
                                ...action.config,
                                template_id: value,
                                template_name: tpl?.name ?? null,
                                subject: tpl?.subject ?? action.config.subject ?? "",
                                body: tpl?.body ?? action.config.body ?? "",
                                snapshot_at: new Date().toISOString(),
                              },
                            });
                          }}
                        >
                          <SelectTrigger>
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
                        {action.config.snapshot_at ? (
                          <p className="text-xs text-muted-foreground">
                            A copy of this template&rsquo;s content is saved with
                            this step. Editing the master template later
                            won&rsquo;t change this step. Re-select the template
                            to refresh the copy.
                          </p>
                        ) : null}
                      </div>
                    )}

                    {action.type === "create_task" && (
                      <>
                        <div className="space-y-2">
                          <Label>Task Title</Label>
                          <Input
                            value={(action.config.title as string) || ""}
                            onChange={(e) =>
                              updateAction(index, {
                                ...action,
                                config: { ...action.config, title: e.target.value },
                              })
                            }
                            placeholder="e.g. Follow up with {{contact.name}}"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Due in (days)</Label>
                          <Input
                            type="number"
                            value={(action.config.due_days as number) || ""}
                            onChange={(e) =>
                              updateAction(index, {
                                ...action,
                                config: {
                                  ...action.config,
                                  due_days: parseInt(e.target.value),
                                },
                              })
                            }
                            placeholder="3"
                          />
                        </div>
                      </>
                    )}

                    {action.type === "delay" && (
                      <div className="space-y-2">
                        <Label>Delay Duration (minutes)</Label>
                        <Input
                          type="number"
                          value={(action.config.minutes as number) || ""}
                          onChange={(e) =>
                            updateAction(index, {
                              ...action,
                              config: {
                                ...action.config,
                                minutes: parseInt(e.target.value),
                              },
                            })
                          }
                          placeholder="60"
                        />
                      </div>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAction(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button
            variant="outline"
            onClick={addAction}
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Action
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
