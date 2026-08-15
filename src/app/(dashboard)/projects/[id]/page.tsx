"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProjectSheet } from "@/components/projects/ProjectSheet";
import { TaskList } from "@/components/tasks/TaskList";
import { projectStatusClasses } from "@/lib/status";
import { cn } from "@/lib/utils";
import {
  contactDisplayName,
  PROJECT_STATUS_LABELS,
  type Contact,
  type Project,
  type Task,
} from "@/types/database";
import { ArrowLeft, Loader2, Pencil, Trash2 } from "lucide-react";

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

function formatBudget(v: number | null, currency: string) {
  if (v == null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(v);
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { activeWorkspace } = useWorkspace();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [pRes, tRes] = await Promise.all([
      fetch(`/api/projects/${projectId}`),
      fetch(`/api/tasks?projectId=${projectId}`),
    ]);
    const pJson = await pRes.json();
    const tJson = await tRes.json();
    if (pRes.ok) setProject(pJson.project);
    if (tRes.ok) setTasks(tJson.tasks ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!activeWorkspace) return;
    fetch(`/api/contacts?workspaceId=${activeWorkspace.id}`)
      .then((r) => r.json())
      .then((j) => setContacts(j.contacts ?? []))
      .catch(() => {});
  }, [activeWorkspace]);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      router.push("/projects");
      router.refresh();
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center">
        <p className="text-muted-foreground">Project not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/projects">Back to projects</Link>
        </Button>
      </div>
    );
  }

  const doneCount = tasks.filter((t) => t.status === "done").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/projects">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <Badge
              variant="outline"
              className={cn("mt-1", projectStatusClasses[project.status])}
            >
              {PROJECT_STATUS_LABELS[project.status]}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Contact</span>
              <span className="text-right font-medium">
                {project.contact ? (
                  <Link
                    href={`/contacts/${project.contact.id}`}
                    className="hover:underline"
                  >
                    {contactDisplayName(project.contact)}
                  </Link>
                ) : (
                  "—"
                )}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Start date</span>
              <span className="font-medium">{formatDate(project.start_date)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Due date</span>
              <span className="font-medium">{formatDate(project.due_date)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Budget</span>
              <span className="font-medium">
                {formatBudget(project.budget, project.currency)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {project.description || "No description."}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Tasks{" "}
            <span className="font-normal text-muted-foreground">
              ({doneCount}/{tasks.length} done)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TaskList
            workspaceId={project.workspace_id}
            projectId={project.id}
            tasks={tasks}
            onChange={setTasks}
          />
        </CardContent>
      </Card>

      <ProjectSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        workspaceId={project.workspace_id}
        contacts={contacts}
        project={project}
        onSaved={() => load()}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
            <DialogDescription>
              This will permanently delete {project.name} and all of its tasks.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
