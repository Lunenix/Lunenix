"use client";

import { useEffect, useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Form, FormField } from "@/types/database";

interface PublicFormPageProps {
  params: { id: string };
}

export default function PublicFormPage({ params }: PublicFormPageProps) {
  const { id } = params;

  const [form, setForm] = useState<Form | null>(null);
  const [formData, setFormData] = useState<Record<string, string | string[] | number | boolean>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchForm();
  }, [id]);

  const fetchForm = async () => {
    setLoading(true);
    try {
      // Use the regular API endpoint which allows public access to active forms
      const res = await fetch(`/api/forms/${id}`);
      if (!res.ok) throw new Error("Form not found");

      const data = await res.json();
      setForm(data.form);
    } catch (error) {
      console.error("Error fetching form:", error);
      setError("Form not found or no longer available");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    // Validate required fields
    const missingFields: string[] = [];
    form.fields.forEach((field) => {
      if (field.required && !formData[field.id]) {
        missingFields.push(field.label);
      }
    });

    if (missingFields.length > 0) {
      setError(`Please fill in required fields: ${missingFields.join(", ")}`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/forms/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submitted_data: formData }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit form");
      }

      setSubmitted(true);
      setFormData({});
    } catch (error) {
      console.error("Error submitting form:", error);
      setError(error instanceof Error ? error.message : "Failed to submit form. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    const value = formData[field.id];
    const stringValue = typeof value === "string" ? value : "";
    const arrayValue = Array.isArray(value) ? value : [];

    switch (field.type) {
      case "text":
      case "email":
      case "phone":
        return (
          <Input
            id={field.id}
            type={field.type}
            value={stringValue}
            onChange={(e) =>
              setFormData({ ...formData, [field.id]: e.target.value })
            }
            placeholder={field.placeholder}
            required={field.required}
          />
        );

      case "number":
        return (
          <Input
            id={field.id}
            type="number"
            value={stringValue}
            onChange={(e) =>
              setFormData({ ...formData, [field.id]: e.target.value })
            }
            placeholder={field.placeholder}
            required={field.required}
          />
        );

      case "date":
        return (
          <Input
            id={field.id}
            type="date"
            value={stringValue}
            onChange={(e) =>
              setFormData({ ...formData, [field.id]: e.target.value })
            }
            required={field.required}
          />
        );

      case "textarea":
        return (
          <Textarea
            id={field.id}
            value={stringValue}
            onChange={(e) =>
              setFormData({ ...formData, [field.id]: e.target.value })
            }
            placeholder={field.placeholder}
            required={field.required}
            rows={4}
          />
        );

      case "select":
        return (
          <Select
            value={stringValue}
            onValueChange={(v) => setFormData({ ...formData, [field.id]: v })}
            required={field.required}
          >
            <SelectTrigger id={field.id}>
              <SelectValue placeholder="Select an option..." />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option, index) => (
                <SelectItem key={index} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "radio":
        return (
          <RadioGroup
            value={stringValue}
            onValueChange={(v) => setFormData({ ...formData, [field.id]: v })}
            required={field.required}
          >
            {field.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${field.id}-${index}`} />
                <Label
                  htmlFor={`${field.id}-${index}`}
                  className="font-normal cursor-pointer"
                >
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case "checkbox":
        return (
          <div className="space-y-2">
            {field.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Checkbox
                  id={`${field.id}-${index}`}
                  checked={arrayValue.includes(option)}
                  onCheckedChange={(checked) => {
                    const newValues = checked
                      ? [...arrayValue, option]
                      : arrayValue.filter((v: string) => v !== option);
                    setFormData({ ...formData, [field.id]: newValues });
                  }}
                />
                <Label
                  htmlFor={`${field.id}-${index}`}
                  className="font-normal cursor-pointer"
                >
                  {option}
                </Label>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-lg text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!form) {
    return null;
  }

  if (form.status !== "active") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-lg text-muted-foreground">
              This form is not currently accepting submissions.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-background p-4 py-12">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">{form.name}</CardTitle>
          {form.description && (
            <p className="text-sm text-muted-foreground">{form.description}</p>
          )}
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Success!</h3>
              <p className="text-center text-muted-foreground">
                {form.success_message}
              </p>
              {form.allow_multiple_submissions && (
                <Button
                  onClick={() => {
                    setSubmitted(false);
                    setFormData({});
                  }}
                  variant="outline"
                  className="mt-6"
                >
                  Submit Another Response
                </Button>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {form.fields.map((field) => (
                <div key={field.id} className="space-y-2">
                  <Label htmlFor={field.id}>
                    {field.label}
                    {field.required && (
                      <span className="ml-1 text-destructive">*</span>
                    )}
                  </Label>
                  {renderField(field)}
                </div>
              ))}

              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  form.submit_button_text || "Submit"
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
