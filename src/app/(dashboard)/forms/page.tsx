"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ClipboardList,
  Loader2,
  Plus,
  ExternalLink,
  FileText,
} from "lucide-react";
import { Form, FORM_STATUS_LABELS } from "@/types/database";
import { formatDateTime } from "@/lib/format";

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
            <Card key={form.id} className="h-full transition-shadow hover:shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="line-clamp-1 text-base">
                      {form.name}
                    </CardTitle>
                    {form.description && (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {form.description}
                      </p>
                    )}
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

                <div className="flex gap-2 pt-2">
                  <Button asChild size="sm" className="flex-1">
                    <Link href={`/forms/${form.id}`}>Edit</Link>
                  </Button>
                  {form.status === "active" && (
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
                        View
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
