"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LeadSheet } from "@/components/pipeline/LeadSheet";
import {
  contactDisplayName,
  isArchived,
  type Contact,
  type Lead,
  type PipelineStage,
} from "@/types/database";
import { Plus, GripVertical, CalendarDays, User2 } from "lucide-react";

interface KanbanBoardProps {
  workspaceId: string;
  pipelineId: string;
  stages: PipelineStage[];
  initialLeads: Lead[];
  contacts: Contact[];
  showArchived?: boolean;
}

function formatCurrency(value: number | null, currency: string) {
  if (value == null) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${value}`;
  }
}

function formatDate(date: string | null) {
  if (!date) return null;
  try {
    return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return date;
  }
}

function LeadCard({
  lead,
  onClick,
  overlay = false,
}: {
  lead: Lead;
  onClick?: () => void;
  overlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id, data: { type: "lead", lead } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const value = formatCurrency(lead.value, lead.currency);
  const closeDate = formatDate(lead.expected_close_date);
  const contactName = lead.contact ? contactDisplayName(lead.contact) : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group rounded-lg border border-border bg-card p-3 shadow-sm transition-colors hover:border-primary/40 ${
        isDragging ? "opacity-40" : ""
      } ${overlay ? "rotate-1 shadow-lg" : ""}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 cursor-grab touch-none text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label="Drag deal"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onClick}
          className="flex-1 text-left"
        >
          <p className="text-sm font-medium leading-snug">{lead.title}</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {value && (
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {value}
              </span>
            )}
            {contactName && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User2 className="h-3 w-3" />
                {contactName}
              </span>
            )}
            {closeDate && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3 w-3" />
                {closeDate}
              </span>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}

function StageColumn({
  stage,
  leads,
  onAddLead,
  onEditLead,
}: {
  stage: PipelineStage;
  leads: Lead[];
  onAddLead: (stageId: string) => void;
  onEditLead: (lead: Lead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: { type: "stage", stageId: stage.id },
  });

  const total = leads.reduce((sum, l) => sum + (l.value ?? 0), 0);

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl bg-muted/40">
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <span className="text-sm font-semibold">{stage.name}</span>
          <Badge variant="secondary" className="h-5 px-1.5 text-xs">
            {leads.length}
          </Badge>
        </div>
        {total > 0 && (
          <span className="text-xs font-medium text-muted-foreground">
            {formatCurrency(total, leads[0]?.currency ?? "USD")}
          </span>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 px-2 pb-2 transition-colors ${
          isOver ? "bg-primary/5" : ""
        }`}
      >
        <SortableContext
          items={leads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onClick={() => onEditLead(lead)}
            />
          ))}
        </SortableContext>

        {leads.length === 0 && (
          <div className="rounded-lg border border-dashed border-border/60 py-6 text-center text-xs text-muted-foreground">
            No deals
          </div>
        )}
      </div>

      <div className="p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={() => onAddLead(stage.id)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add deal
        </Button>
      </div>
    </div>
  );
}

export function KanbanBoard({
  workspaceId,
  pipelineId,
  stages,
  initialLeads,
  contacts,
  showArchived = false,
}: KanbanBoardProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetStageId, setSheetStageId] = useState<string>("");
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const leadsByStage = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const stage of stages) map[stage.id] = [];
    for (const lead of leads) {
      if (!map[lead.stage_id]) map[lead.stage_id] = [];
      map[lead.stage_id].push(lead);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.position - b.position);
    }
    return map;
  }, [leads, stages]);

  function findStageIdForLead(id: string): string | null {
    const lead = leads.find((l) => l.id === id);
    return lead ? lead.stage_id : null;
  }

  function handleDragStart(event: DragStartEvent) {
    const lead = leads.find((l) => l.id === event.active.id);
    setActiveLead(lead ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeStageId = findStageIdForLead(activeId);
    // Over a column droppable or over another card.
    const overStageId =
      over.data.current?.type === "stage"
        ? overId
        : findStageIdForLead(overId);

    if (!activeStageId || !overStageId || activeStageId === overStageId) return;

    // Move card to the new stage optimistically (cross-column).
    setLeads((prev) =>
      prev.map((l) =>
        l.id === activeId ? { ...l, stage_id: overStageId } : l
      )
    );
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveLead(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const targetStageId =
      over.data.current?.type === "stage"
        ? overId
        : findStageIdForLead(overId);
    if (!targetStageId) return;

    // Build the new ordering within the target stage.
    setLeads((prev) => {
      const inStage = prev
        .filter((l) => l.stage_id === targetStageId)
        .sort((a, b) => a.position - b.position);

      const withoutActive = inStage.filter((l) => l.id !== activeId);
      const activeLeadObj = prev.find((l) => l.id === activeId);
      if (!activeLeadObj) return prev;

      let insertIndex = withoutActive.length;
      if (over.data.current?.type !== "stage") {
        const overIndex = withoutActive.findIndex((l) => l.id === overId);
        if (overIndex >= 0) insertIndex = overIndex;
      }

      const reordered = [
        ...withoutActive.slice(0, insertIndex),
        { ...activeLeadObj, stage_id: targetStageId },
        ...withoutActive.slice(insertIndex),
      ];

      const positionMap = new Map<string, number>();
      reordered.forEach((l, i) => positionMap.set(l.id, i));

      // Persist the moved lead's stage + position.
      const newPosition = positionMap.get(activeId) ?? 0;
      void fetch(`/api/leads/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage_id: targetStageId,
          position: newPosition,
        }),
      });

      return prev.map((l) => {
        if (l.stage_id !== targetStageId && l.id !== activeId) return l;
        const pos = positionMap.get(l.id);
        if (pos == null) return l;
        return { ...l, stage_id: targetStageId, position: pos };
      });
    });
  }

  function handleAddLead(stageId: string) {
    setEditingLead(null);
    setSheetStageId(stageId);
    setSheetOpen(true);
  }

  function handleEditLead(lead: Lead) {
    setEditingLead(lead);
    setSheetStageId(lead.stage_id);
    setSheetOpen(true);
  }

  function handleSaved(saved: Lead) {
    const archivedOnBoard =
      isArchived(saved) || Boolean(saved.contact && isArchived(saved.contact));
    const shouldShow = showArchived ? archivedOnBoard : !archivedOnBoard;
    setLeads((prev) => {
      if (!shouldShow) {
        return prev.filter((l) => l.id !== saved.id);
      }
      const exists = prev.some((l) => l.id === saved.id);
      if (exists) {
        return prev.map((l) => (l.id === saved.id ? saved : l));
      }
      return [...prev, saved];
    });
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              leads={leadsByStage[stage.id] ?? []}
              onAddLead={handleAddLead}
              onEditLead={handleEditLead}
            />
          ))}
        </div>

        <DragOverlay>
          {activeLead ? <LeadCard lead={activeLead} overlay /> : null}
        </DragOverlay>
      </DndContext>

      <LeadSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        workspaceId={workspaceId}
        pipelineId={pipelineId}
        stageId={sheetStageId}
        contacts={contacts}
        lead={editingLead}
        onSaved={handleSaved}
      />
    </>
  );
}
