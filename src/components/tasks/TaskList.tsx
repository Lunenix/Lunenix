"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskSheet } from "@/components/tasks/TaskSheet";
import { cn } from "@/lib/utils";
import {
  contactDisplayName,
  TASK_PRIORITY_LABELS,
  type Task,
  type TaskPriority,
} from "@/types/database";
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";

interface TaskListProps {
  workspaceId: string;
  projectId: string | null;
  tasks: Task[];
  onChange: (tasks: Task[]) => void;
  /** Show the linked project name on each row (used by the all-tasks view). */
  showProject?: boolean;
}

const priorityClasses: Record<TaskPriority, string> = {
  low: "border-slate-500/40 text-slate-400",
  medium: "border-blue-500/40 text-blue-400",
  high: "border-amber-500/40 text-amber-400",
  urgent: "border-red-500/40 text-red-400",
};

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function TaskList({
  workspaceId,
  projectId,
  tasks,
  onChange,
  showProject = false,
}: TaskListProps) {
  const [quickTitle, setQuickTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  async function toggleDone(task: Task, done: boolean) {
    const nextStatus = done ? "done" : "todo";
    // Optimistic update.
    onChange(
      tasks.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: nextStatus,
              completed_at: done ? new Date().toISOString() : null,
            }
          : t
      )
    );
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) {
      const json = await res.json();
      onChange(tasks.map((t) => (t.id === task.id ? json.task : t)));
    }
  }

  async function quickAdd() {
    const title = quickTitle.trim();
    if (!title) return;
    setAdding(true);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: workspaceId,
        project_id: projectId,
        title,
      }),
    });
    setAdding(false);
    if (res.ok) {
      const json = await res.json();
      onChange([...tasks, json.task]);
      setQuickTitle("");
    }
  }

  async function deleteTask(task: Task) {
    onChange(tasks.filter((t) => t.id !== task.id));
    await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
  }

  const sorted = [...tasks].sort((a, b) => {
    if (a.status === "done" && b.status !== "done") return 1;
    if (a.status !== "done" && b.status === "done") return -1;
    return a.position - b.position;
  });

  return (
    <div className="space-y-2">
      {sorted.length === 0 && (
        <p className="py-2 text-sm text-muted-foreground">No tasks yet.</p>
      )}

      {sorted.map((task) => {
        const done = task.status === "done";
        const due = formatDate(task.due_date);
        return (
          <div
            key={task.id}
            className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
          >
            <Checkbox
              checked={done}
              onCheckedChange={(v) => toggleDone(task, Boolean(v))}
            />
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "truncate text-sm font-medium",
                  done && "text-muted-foreground line-through"
                )}
              >
                {task.title}
              </p>
              {(showProject && task.project?.name) || task.contact ? (
                <p className="truncate text-xs text-muted-foreground">
                  {[
                    showProject ? task.project?.name : null,
                    task.contact ? contactDisplayName(task.contact) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </div>

            {task.status === "in_progress" && (
              <Badge variant="secondary" className="hidden sm:inline-flex">
                In progress
              </Badge>
            )}

            <Badge
              variant="outline"
              className={cn("hidden sm:inline-flex", priorityClasses[task.priority])}
            >
              {TASK_PRIORITY_LABELS[task.priority]}
            </Badge>

            {due && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {due}
              </span>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setEditing(task);
                    setSheetOpen(true);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => deleteTask(task)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}

      <div className="flex items-center gap-2 pt-2">
        <Input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") quickAdd();
          }}
          placeholder="Add a task and press Enter…"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={quickAdd}
          disabled={adding || !quickTitle.trim()}
        >
          {adding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
        <Button
          onClick={() => {
            setEditing(null);
            setSheetOpen(true);
          }}
        >
          New task
        </Button>
      </div>

      <TaskSheet
        open={sheetOpen}
        onOpenChange={(next) => {
          setSheetOpen(next);
          if (!next) setEditing(null);
        }}
        workspaceId={workspaceId}
        projectId={projectId}
        task={editing}
        onSaved={(saved) => {
          const exists = tasks.some((t) => t.id === saved.id);
          onChange(
            exists
              ? tasks.map((t) => (t.id === saved.id ? saved : t))
              : [...tasks, saved]
          );
        }}
      />
    </div>
  );
}
