"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { TaskList } from "@/components/tasks/TaskList";
import { cn } from "@/lib/utils";
import { type Task, type TaskStatus } from "@/types/database";
import { Loader2 } from "lucide-react";

type Filter = "all" | TaskStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];

export default function TasksPage() {
  const { activeWorkspace, isLoading: wsLoading } = useWorkspace();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    const res = await fetch(`/api/tasks?workspaceId=${activeWorkspace.id}`);
    const json = await res.json();
    if (res.ok) setTasks(json.tasks ?? []);
    setLoading(false);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  const filtered = useMemo(() => {
    if (filter === "all") return tasks;
    return tasks.filter((t) => t.status === filter);
  }, [tasks, filter]);

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
          Create or select a workspace to manage tasks.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
        <p className="text-sm text-muted-foreground">
          Every task across {activeWorkspace.name}. Add one here and optionally
          assign a client.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.key)}
            className={cn(filter !== f.key && "text-muted-foreground")}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <TaskList
          workspaceId={activeWorkspace.id}
          projectId={null}
          tasks={filtered}
          onChange={(updated) => {
            setTasks((prev) => {
              const map = new Map(prev.map((t) => [t.id, t]));
              for (const t of updated) map.set(t.id, t);
              const updatedIds = new Set(updated.map((t) => t.id));
              const removed = filtered
                .filter((t) => !updatedIds.has(t.id))
                .map((t) => t.id);
              for (const id of removed) map.delete(id);
              return Array.from(map.values());
            });
          }}
          showProject
        />
      )}
    </div>
  );
}
