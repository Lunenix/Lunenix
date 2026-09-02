"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Zap, Plus, Power, PowerOff } from "lucide-react";
import { AUTOMATION_TRIGGER_LABELS } from "@/types/database";
import type { AutomationWorkflow } from "@/types/database";

export default function AutomationPage() {
  const { activeWorkspace, isLoading: workspaceLoading } = useWorkspace();
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (activeWorkspace) {
      fetchWorkflows();
    }
  }, [activeWorkspace]);

  const fetchWorkflows = async () => {
    if (!activeWorkspace) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/automation-workflows?workspaceId=${activeWorkspace.id}`
      );
      const data = await response.json();
      setWorkflows(data.workflows || []);
    } catch (error) {
      console.error("Error fetching workflows:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleWorkflow = async (workflowId: string) => {
    try {
      const response = await fetch(
        `/api/automation-workflows/${workflowId}/toggle`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to toggle workflow");
      }

      // Refresh the list
      fetchWorkflows();
    } catch (error) {
      console.error("Error toggling workflow:", error);
      alert("Failed to toggle workflow. Please try again.");
    }
  };

  if (workspaceLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Zap className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No workspace selected</h3>
        <p className="text-sm text-muted-foreground">
          Please select a workspace to view automation workflows
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Automation Workflows</h1>
          <p className="text-muted-foreground">
            Automate follow-up. Every industry gets its own default pack from
            a new lead through invoice — packs are not merged across
            workspaces. Turn them off anytime.
          </p>
        </div>
        <Link href="/automation/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Workflow
          </Button>
        </Link>
      </div>

      {workflows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Zap className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              No automation workflows yet
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first workflow to automate tasks
            </p>
            <Link href="/automation/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Workflow
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Workflows</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflows.map((workflow) => (
                  <TableRow key={workflow.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/automation/${workflow.id}`}
                        className="hover:underline"
                      >
                        {workflow.name}
                      </Link>
                      {workflow.description && (
                        <div className="text-sm text-muted-foreground truncate max-w-xs">
                          {workflow.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {AUTOMATION_TRIGGER_LABELS[workflow.trigger_type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {workflow.actions.length} action(s)
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={workflow.is_active ? "default" : "secondary"}
                      >
                        {workflow.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleWorkflow(workflow.id)}
                        >
                          {workflow.is_active ? (
                            <>
                              <PowerOff className="mr-1 h-3 w-3" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <Power className="mr-1 h-3 w-3" />
                              Activate
                            </>
                          )}
                        </Button>
                        <Link href={`/automation/${workflow.id}`}>
                          <Button variant="ghost" size="sm">
                            Edit
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
