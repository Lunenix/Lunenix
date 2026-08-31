"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { FormBuilder } from "@/components/forms/FormBuilder";
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
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Loader2,
  Save,
  Trash2,
  Check,
  Link as LinkIcon,
} from "lucide-react";
import { Form, FormField, FormStatus } from "@/types/database";

interface FormBuilderPageProps {
  params: { id: string };
}

export default function FormBuilderPage({ params }: FormBuilderPageProps) {
  const { id } = params;
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();

  const isNew = id === "new";

  const [form, setForm] = useState<Form | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<FormStatus>("draft");
  const [fields, setFields] = useState<FormField[]>([]);
  const [submitButtonText, setSubmitButtonText] = useState("Submit");
  const [successMessage, setSuccessMessage] = useState(
    "Thank you for your submission!"
  );
  const [allowMultipleSubmissions, setAllowMultipleSubmissions] = useState(true);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isNew && id && activeWorkspace?.id) {
      fetchForm();
    }
  }, [id, activeWorkspace?.id, isNew]);

  const fetchForm = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/forms/${id}`);
      const data = await res.json();
      const fetchedForm = data.form;

      setForm(fetchedForm);
      setName(fetchedForm.name);
      setDescription(fetchedForm.description || "");
      setStatus(fetchedForm.status);
      setFields(fetchedForm.fields || []);
      setSubmitButtonText(fetchedForm.submit_button_text || "Submit");
      setSuccessMessage(
        fetchedForm.success_message || "Thank you for your submission!"
      );
      setAllowMultipleSubmissions(fetchedForm.allow_multiple_submissions !== false);
    } catch (error) {
      console.error("Error fetching form:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Form name is required");
      return;
    }

    if (!activeWorkspace?.id) {
      alert("No active workspace");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        workspace_id: activeWorkspace.id,
        name: name.trim(),
        description: description.trim() || null,
        status,
        fields,
        submit_button_text: submitButtonText,
        success_message: successMessage,
        allow_multiple_submissions: allowMultipleSubmissions,
      };

      const url = isNew ? "/api/forms" : `/api/forms/${id}`;
      const method = isNew ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save form");

      const data = await res.json();

      if (isNew) {
        router.push(`/forms/${data.form.id}`);
      } else {
        fetchForm();
      }
    } catch (error) {
      console.error("Error saving form:", error);
      alert("Failed to save form. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!form) return;
    if (
      !confirm(
        `Are you sure you want to delete form "${form.name}"? This will also delete all submissions.`
      )
    )
      return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/forms/${form.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete form");
      router.push("/forms");
    } catch (error) {
      console.error("Error deleting form:", error);
      alert("Failed to delete form");
    } finally {
      setDeleting(false);
    }
  };

  const copyPublicUrl = () => {
    const publicUrl = `${window.location.origin}/f/${isNew ? "FORM_ID" : id}`;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/f/${id}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1">
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
            <Link href="/forms">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Forms
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">
            {isNew ? "Create Form" : "Edit Form"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isNew
              ? "Build a custom form for your workspace"
              : "Update form details and fields"}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save"}
          </Button>
          {!isNew && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Settings Panel */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Form Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  Form Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Client Intake Form"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this form"
                  rows={3}
                />
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as FormStatus)}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Only active forms can receive submissions
                </p>
              </div>

              {/* Submit Button Text */}
              <div className="space-y-2">
                <Label htmlFor="submit-button">Submit Button Text</Label>
                <Input
                  id="submit-button"
                  value={submitButtonText}
                  onChange={(e) => setSubmitButtonText(e.target.value)}
                  placeholder="Submit"
                />
              </div>

              {/* Success Message */}
              <div className="space-y-2">
                <Label htmlFor="success-msg">Success Message</Label>
                <Textarea
                  id="success-msg"
                  value={successMessage}
                  onChange={(e) => setSuccessMessage(e.target.value)}
                  placeholder="Thank you for your submission!"
                  rows={2}
                />
              </div>

              {/* Allow Multiple Submissions */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allow-multiple"
                  checked={allowMultipleSubmissions}
                  onCheckedChange={(checked) =>
                    setAllowMultipleSubmissions(!!checked)
                  }
                />
                <Label
                  htmlFor="allow-multiple"
                  className="text-sm font-normal cursor-pointer"
                >
                  Allow multiple submissions
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Public URL */}
          {!isNew && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="h-5 w-5" />
                  Share Form
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Use this link on your website, in emails, or anywhere you want to collect form submissions.
                </p>
                
                {/* URL Display */}
                <div className="rounded-md bg-muted p-3">
                  <p className="text-xs font-mono break-all text-muted-foreground">
                    {publicUrl}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full"
                    onClick={copyPublicUrl}
                  >
                    {copied ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Link Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Link
                      </>
                    )}
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="w-full"
                  >
                    <Link
                      href={publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Preview Form
                    </Link>
                  </Button>
                </div>

                {status !== "active" && (
                  <p className="text-xs text-amber-500/90 border-t pt-3">
                    ⚠️ This form is <strong>{status}</strong>. Set status to <strong>Active</strong> and Save so people can actually submit it.
                  </p>
                )}
                <p className="text-xs text-muted-foreground border-t pt-3">
                  💡 Tip: Embed this link as a button on your website or share it directly with clients.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Form Builder */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Form Fields</CardTitle>
            </CardHeader>
            <CardContent>
              <FormBuilder fields={fields} onChange={setFields} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
