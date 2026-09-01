"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ClipboardList,
  Loader2,
  Plus,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  Check,
  Trash2,
} from "lucide-react";
import { Form, FORM_STATUS_LABELS } from "@/types/database";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

function formStatusClasses(status: string): string {
  const classes: Record<string, string> = {
    draft: "border-slate-500/40 text-slate-400",
    active: "border-green-500/40 text-green-400",
    archived: "border-gray-500/40 text-gray-400",
  };
  return classes[status] || "";
}

export default function FormsPage() {
  const { activeWorkspace, isLoading: workspaceLoading } = useWorkspace();
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    if (activeWorkspace?.id) {
      fetchForms();
    }
  }, [activeWorkspace?.id]);

  const fetchForms = async () => {
    if (!activeWorkspace?.id) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/forms?workspaceId=${activeWorkspace.id}`);
      const data = await res.json();
      setForms(data.forms || []);
      setSelectedIds(new Set());
    } catch (error) {
      console.error("Error fetching forms:", error);
    } finally {
      setLoading(false);
    }
  };

  if (workspaceLoading || loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-muted-foreground">No active workspace</p>
      </div>
    );
  }

  const publicUrl = typeof window !== "undefined" ? window.location.origin : "";

  const copyFormLink = (formId: string) => {
    const url = `${publicUrl}/f/${formId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(formId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleSelected = (formId: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(formId);
      else next.delete(formId);
      return next;
    });
  };

  const allSelected = forms.length > 0 && forms.every((f) => selectedIds.has(f.id));

  const toggleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(forms.map((f) => f.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleDelete = async (form: Form) => {
    if (
      !confirm(
        `Delete form "${form.name}"? This will also delete all submissions.`
      )
    ) {
      return;
    }
    setDeletingId(form.id);
    try {
      const res = await fetch(`/api/forms/${form.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete form");
      setForms((prev) => prev.filter((f) => f.id !== form.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(form.id);
        return next;
      });
      toast(`Deleted ${form.name}.`, "success");
    } catch (error) {
      console.error("Error deleting form:", error);
      toast("Failed to delete form.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteSelected = async () => {
    const selected = forms.filter((f) => selectedIds.has(f.id));
    if (!selected.length) return;
    if (
      !confirm(
        `Delete ${selected.length} form${selected.length === 1 ? "" : "s"}? This will also delete all submissions.`
      )
    ) {
      return;
    }
    setBulkDeleting(true);
    const deleted = new Set<string>();
    const failed: string[] = [];
    try {
      await Promise.all(
        selected.map(async (form) => {
          const res = await fetch(`/api/forms/${form.id}`, { method: "DELETE" });
          if (res.ok) deleted.add(form.id);
          else failed.push(form.name);
        })
      );
      setForms((prev) => prev.filter((f) => !deleted.has(f.id)));
      setSelectedIds(new Set());
      if (deleted.size) {
        toast(
          `Deleted ${deleted.size} form${deleted.size === 1 ? "" : "s"}.`,
          "success"
        );
      }
      if (failed.length) {
        toast(`Could not delete: ${failed.join(", ")}`, "error");
      }
    } catch (error) {
      console.error("Error deleting forms:", error);
      toast("Failed to delete selected forms.", "error");
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Forms</h1>
          <p className="text-muted-foreground">
            Create and manage intake forms and questionnaires
          </p>
        </div>
        <Button asChild>
          <Link href="/forms/new">
            <Plus className="mr-2 h-4 w-4" />
            New Form
          </Link>
        </Button>
      </div>

      {forms.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/50 px-4 py-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={allSelected ? true : selectedIds.size > 0 ? "indeterminate" : false}
              onCheckedChange={(value) => toggleSelectAll(value === true)}
              aria-label="Select all forms"
            />
            <span className="text-muted-foreground">
              {selectedIds.size > 0
                ? `${selectedIds.size} selected`
                : "Select forms"}
            </span>
          </label>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={selectedIds.size === 0 || bulkDeleting}
            onClick={() => void handleDeleteSelected()}
          >
            {bulkDeleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Delete selected
          </Button>
        </div>
      )}

      {/* Empty State */}
      {forms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardList className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No forms yet</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Get started by creating your first form
            </p>
            <Button asChild>
              <Link href="/forms/new">
                <Plus className="mr-2 h-4 w-4" />
                New Form
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Forms Grid */
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {forms.map((form) => (
            <Card
              key={form.id}
              className={cn(
                "h-full transition-shadow hover:shadow-lg",
                selectedIds.has(form.id) && "ring-2 ring-primary"
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <Checkbox
                      className="mt-1"
                      checked={selectedIds.has(form.id)}
                      onCheckedChange={(value) =>
                        toggleSelected(form.id, value === true)
                      }
                      aria-label={`Select ${form.name}`}
                      disabled={bulkDeleting}
                    />
                    <div className="min-w-0 flex-1">
                      <CardTitle className="line-clamp-1 text-base">
                        {form.name}
                      </CardTitle>
                    {form.description && (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {form.description}
                      </p>
                    )}
                    </div>
                  </div>
                  <Badge className={formStatusClasses(form.status)}>
                    {FORM_STATUS_LABELS[form.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span>
                    {form.fields.length} field{form.fields.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="text-xs text-muted-foreground">
                  Created {formatDateTime(form.created_at)}
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => copyFormLink(form.id)}
                    className="w-full"
                  >
                    {copiedId === form.id ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Link Copied!
                      </>
                    ) : (
                      <>
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Copy Form Link
                      </>
                    )}
                  </Button>
                  {form.status !== "active" && (
                    <p className="text-xs text-amber-500/90">
                      ⚠️ Set status to <strong>Active</strong> so people can submit this form.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button asChild size="sm" variant="outline" className="flex-1">
                      <Link href={`/forms/${form.id}`}>Edit</Link>
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="flex-1"
                    >
                      <Link
                        href={`${publicUrl}/f/${form.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="mr-1 h-3 w-3" />
                        Preview
                      </Link>
                    </Button>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="w-full"
                    disabled={deletingId === form.id || bulkDeleting}
                    onClick={() => handleDelete(form)}
                  >
                    {deletingId === form.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    {deletingId === form.id ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
