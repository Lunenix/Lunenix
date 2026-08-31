"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProjectSheet } from "@/components/projects/ProjectSheet";
import { cn } from "@/lib/utils";
import { projectStatusClasses } from "@/lib/status";
import {
  contactDisplayName,
  PROJECT_STATUS_LABELS,
  type Contact,
  type Project,
} from "@/types/database";
import { FolderKanban, Loader2, Plus } from "lucide-react";

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

function formatBudget(v: number | null, currency: string) {
  if (v == null) return null;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(v);
}

export default function ProjectsPage() {
  const { activeWorkspace, isLoading: wsLoading } = useWorkspace();
  const [projects, setProjects] = useState<Project[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    const [pRes, cRes] = await Promise.all([
      fetch(`/api/projects?workspaceId=${activeWorkspace.id}`),
      fetch(`/api/contacts?workspaceId=${activeWorkspace.id}`),
    ]);
    const pJson = await pRes.json();
    const cJson = await cRes.json();
    if (pRes.ok) setProjects(pJson.projects ?? []);
    if (cRes.ok) setContacts(cJson.contacts ?? []);
    setLoading(false);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  if (wsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center">
        <p className="text-muted-foreground">
          Create or select a workspace to manage projects.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Jobs and engagements in {activeWorkspace.name}
          </p>
        </div>
        <Button onClick={() => setSheetOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : projects.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <FolderKanban className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium">No projects yet</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Create your first project or job to get started.
          </p>
          <Button onClick={() => setSheetOpen(true)} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const total = p.task_count ?? 0;
            const open = p.open_task_count ?? 0;
            const doneCount = total - open;
            const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
            const budget = formatBudget(p.budget, p.currency);
            return (
              <Link key={p.id} href={`/projects/${p.id}`}>
                <Card className="h-full transition-colors hover:border-primary/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-tight">{p.name}</h3>
                      <Badge
                        variant="outline"
                        className={cn("shrink-0", projectStatusClasses[p.status])}
                      >
                        {PROJECT_STATUS_LABELS[p.status]}
                      </Badge>
                    </div>
                    {p.contact && (
                      <p className="text-xs text-muted-foreground">
                        {contactDisplayName(p.contact)}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Due {formatDate(p.due_date)}</span>
                      {budget && <span>{budget}</span>}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Tasks</span>
                        <span>
                          {doneCount}/{total} done
                        </span>
                      </div>
                      <Progress value={pct} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <ProjectSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        workspaceId={activeWorkspace.id}
        contacts={contacts}
        onSaved={() => load()}
      />
    </div>
  );
}
