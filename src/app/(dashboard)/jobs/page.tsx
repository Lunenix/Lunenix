"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PROJECT_STATUS_LABELS, type Project } from "@/types/database";
import { Loader2 } from "lucide-react";

export default function JobsPage() {
  const { activeWorkspace } = useWorkspace();
  const [jobs, setJobs] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const res = await fetch(`/api/projects?workspaceId=${activeWorkspace.id}`);
    const json = await res.json();
    if (res.ok) setJobs(json.projects ?? []);
    setLoading(false);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Jobs</h1>
        <p className="text-muted-foreground">
          Jobs are workspace projects. Approve an estimate to create one.
          Assign a tech and mark urgent on the job record.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Job</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Flags</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((j) => (
            <TableRow key={j.id}>
              <TableCell>
                <Link className="font-medium underline" href={`/projects/${j.id}`}>
                  {j.name}
                </Link>
              </TableCell>
              <TableCell>
                {PROJECT_STATUS_LABELS[j.status] ?? j.status}
              </TableCell>
              <TableCell>
                {j.due_date ? new Date(j.due_date).toLocaleDateString() : "—"}
              </TableCell>
              <TableCell className="space-x-1">
                {j.urgent ? <Badge>Urgent</Badge> : null}
                {!j.assignee_id &&
                j.status !== "completed" &&
                j.status !== "cancelled" ? (
                  <Badge variant="outline">Unassigned</Badge>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
