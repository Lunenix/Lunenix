"use client";

import { useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { GripVertical, Plus, Trash2, Settings2 } from "lucide-react";
import {
  FormField,
  FormFieldType,
  FORM_FIELD_TYPE_LABELS,
} from "@/types/database";
import { cn } from "@/lib/utils";

interface FormBuilderProps {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
}

export function FormBuilder({ fields, onChange }: FormBuilderProps) {
  const [editingField, setEditingField] = useState<string | null>(null);

  const addField = () => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type: "text",
      label: "New Field",
      placeholder: "",
      required: false,
      options: [],
    };
    onChange([...fields, newField]);
    setEditingField(newField.id);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    onChange(
      fields.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const removeField = (id: string) => {
    onChange(fields.filter((f) => f.id !== id));
    if (editingField === id) {
      setEditingField(null);
    }
  };

  const moveField = (index: number, direction: "up" | "down") => {
    const newFields = [...fields];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newFields.length) return;

    [newFields[index], newFields[targetIndex]] = [
      newFields[targetIndex],
      newFields[index],
    ];
    onChange(newFields);
  };

  const hasOptions = (type: FormFieldType) =>
    ["select", "radio", "checkbox"].includes(type);

  return (
    <div className="space-y-4">
      {/* Field List */}
      <div className="space-y-3">
        {fields.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Settings2 className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No fields yet</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Add your first field to start building your form
              </p>
              <Button onClick={addField}>
                <Plus className="mr-2 h-4 w-4" />
                Add Field
              </Button>
            </CardContent>
          </Card>
        ) : (
          fields.map((field, index) => (
            <Card
              key={field.id}
              className={cn(
                "transition-shadow",
                editingField === field.id && "ring-2 ring-primary"
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <GripVertical className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base line-clamp-1">
                        {field.label}
                        {field.required && (
                          <span className="ml-1 text-destructive">*</span>
                        )}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {FORM_FIELD_TYPE_LABELS[field.type]}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => moveField(index, "up")}
                      disabled={index === 0}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => moveField(index, "down")}
                      disabled={index === fields.length - 1}
                    >
                      ↓
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setEditingField(
                          editingField === field.id ? null : field.id
                        )
                      }
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeField(field.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Field Editor */}
              {editingField === field.id && (
                <CardContent className="space-y-4 border-t pt-4">
                  {/* Field Type */}
                  <div className="space-y-2">
                    <Label>Field Type</Label>
                    <Select
                      value={field.type}
                      onValueChange={(v) =>
                        updateField(field.id, {
                          type: v as FormFieldType,
                          options: hasOptions(v as FormFieldType)
                            ? field.options || ["Option 1"]
                            : undefined,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(FORM_FIELD_TYPE_LABELS).map(
                          ([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Label */}
                  <div className="space-y-2">
                    <Label>Label</Label>
                    <Input
                      value={field.label}
                      onChange={(e) =>
                        updateField(field.id, { label: e.target.value })
                      }
                      placeholder="Enter field label"
                    />
                  </div>

                  {/* Placeholder */}
                  {!hasOptions(field.type) && (
                    <div className="space-y-2">
                      <Label>Placeholder (optional)</Label>
                      <Input
                        value={field.placeholder || ""}
                        onChange={(e) =>
                          updateField(field.id, { placeholder: e.target.value })
                        }
                        placeholder="Enter placeholder text"
                      />
                    </div>
                  )}

                  {/* Options for select/radio/checkbox */}
                  {hasOptions(field.type) && (
                    <div className="space-y-2">
                      <Label>Options</Label>
                      <Textarea
                        value={(field.options || []).join("\n")}
                        onChange={(e) =>
                          updateField(field.id, {
                            options: e.target.value
                              .split("\n")
                              .filter((o) => o.trim()),
                          })
                        }
                        placeholder="Enter one option per line"
                        rows={4}
                      />
                      <p className="text-xs text-muted-foreground">
                        One option per line
                      </p>
                    </div>
                  )}

                  {/* Required */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`required-${field.id}`}
                      checked={field.required}
                      onCheckedChange={(checked) =>
                        updateField(field.id, { required: !!checked })
                      }
                    />
                    <Label
                      htmlFor={`required-${field.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      Required field
                    </Label>
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Add Field Button */}
      {fields.length > 0 && (
        <Button onClick={addField} variant="outline" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Add Field
        </Button>
      )}
    </div>
  );
}
