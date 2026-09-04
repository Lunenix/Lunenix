"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/pipeline/KanbanBoard";
import type {
  Contact,
  Lead,
  Pipeline,
  PipelineStage,
} from "@/types/database";
import { Loader2, KanbanSquare, Archive, ArchiveRestore } from "lucide-react";
import { BAR_LEAD_SOURCES, isMobileBartendingWorkspace } from "@/lib/barService";
import {
  PLANNER_LEAD_SOURCES,
  isEventPlannerWorkspace,
} from "@/lib/plannerService";
import {
  VENUE_LEAD_SOURCES,
  isEventVenueWorkspace,
} from "@/lib/venueService";
import {
  BRIDAL_LEAD_SOURCES,
  isBridalShopWorkspace,
} from "@/lib/bridalService";
import {
  CATERING_LEAD_SOURCES,
  isCatererWorkspace,
} from "@/lib/cateringService";
import {
  CHEF_LEAD_SOURCES,
  isPrivateChefWorkspace,
} from "@/lib/chefService";

export default function PipelinePage() {
  const { activeWorkspace, isLoading: wsLoading } = useWorkspace();
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    const pipelineQs = new URLSearchParams({
      workspaceId: activeWorkspace.id,
    });
    if (showArchived) pipelineQs.set("archived", "1");
    const [pRes, cRes] = await Promise.all([
      fetch(`/api/pipeline?${pipelineQs.toString()}`),
      fetch(`/api/contacts?workspaceId=${activeWorkspace.id}`),
    ]);
    const pJson = await pRes.json();
    const cJson = await cRes.json();
    if (pRes.ok) {
      setPipeline(pJson.pipeline ?? null);
      setStages(pJson.stages ?? []);
      setLeads(pJson.leads ?? []);
    }
    if (cRes.ok) setContacts(cJson.contacts ?? []);
    setLoading(false);
  }, [activeWorkspace, showArchived]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function createPipeline() {
    if (!activeWorkspace) return;
    setCreating(true);
    const res = await fetch("/api/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: activeWorkspace.id }),
    });
    const json = await res.json();
    if (res.ok) {
      setPipeline(json.pipeline ?? null);
      setStages(json.stages ?? []);
      setLeads(json.leads ?? []);
    }
    setCreating(false);
  }

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
          Create or select a workspace to manage your pipeline.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Track deals through your stages in {activeWorkspace.name}. Archive
            a deal from its card sheet to hide it from the board.
          </p>
        </div>
        {pipeline ? (
          <Button
            variant={showArchived ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? (
              <ArchiveRestore className="mr-2 h-4 w-4" />
            ) : (
              <Archive className="mr-2 h-4 w-4" />
            )}
            {showArchived ? "Showing archived" : "Show archived"}
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !pipeline ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <KanbanSquare className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium">No pipeline yet</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Create a sales pipeline with default stages to start tracking deals.
          </p>
          <Button onClick={createPipeline} disabled={creating}>
            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Pipeline
          </Button>
        </div>
      ) : (
        <KanbanBoard
          workspaceId={activeWorkspace.id}
          pipelineId={pipeline.id}
          stages={stages}
          initialLeads={leads}
          contacts={contacts}
          showArchived={showArchived}
          sourceSuggestions={
            isPrivateChefWorkspace(activeWorkspace.industry_preset)
              ? [...CHEF_LEAD_SOURCES]
              : isCatererWorkspace(activeWorkspace.industry_preset)
              ? [...CATERING_LEAD_SOURCES]
              : isBridalShopWorkspace(activeWorkspace.industry_preset)
              ? [...BRIDAL_LEAD_SOURCES]
              : isEventVenueWorkspace(activeWorkspace.industry_preset)
              ? [...VENUE_LEAD_SOURCES]
              : isEventPlannerWorkspace(activeWorkspace.industry_preset)
              ? [...PLANNER_LEAD_SOURCES]
              : isMobileBartendingWorkspace(activeWorkspace.industry_preset)
                ? [...BAR_LEAD_SOURCES]
                : undefined
          }
        />
      )}
    </div>
  );
}
