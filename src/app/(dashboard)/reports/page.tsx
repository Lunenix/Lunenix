"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  REPORT_STATUSES,
  REPORT_STATUS_LABELS,
} from "@/lib/fieldService";
import {
  contactDisplayName,
  type InspectionReport,
  type Project,
} from "@/types/database";
import { Loader2 } from "lucide-react";

export default function ReportsPage() {
  const { activeWorkspace } = useWorkspace();
  const [rows, setRows] = useState<InspectionReport[]>([]);
  const [jobs, setJobs] = useState<Project[]>([]);
  const [title, setTitle] = useState("");
  const [agent, setAgent] = useState("");
  const [sellerAgent, setSellerAgent] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [size, setSize] = useState("");
  const [closing, setClosing] = useState("");
  const [due, setDue] = useState("");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const id = activeWorkspace.id;
    const [r, j] = await Promise.all([
      fetch(`/api/inspection-reports?workspaceId=${id}`),
      fetch(`/api/projects?workspaceId=${id}`),
    ]);
    const rj = await r.json();
    const jj = await j.json();
    if (r.ok) setRows(rj.reports ?? []);
    if (j.ok) setJobs(jj.projects ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function add() {
    if (!activeWorkspace || !title.trim()) return;
    setSaving(true);
    await fetch("/api/inspection-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        title: title.trim(),
        build_from_findings: true,
        agent_name: agent.trim() || null,
        seller_agent_name: sellerAgent.trim() || null,
        property_type: propertyType.trim() || null,
        property_size: size.trim() || null,
        closing_on: closing || null,
        due_at: due || null,
        project_id: projectId || null,
        contact_id: jobs.find((j) => j.id === projectId)?.contact_id || null,
      }),
    });
    setSaving(false);
    setTitle("");
    setAgent("");
    setSellerAgent("");
    setPropertyType("");
    setSize("");
    load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/inspection-reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">
          Build a summary from Findings, set a due date near closing, then share
          the link. Clients can print to PDF from the public page. Two-way SMS
          is not live.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Report title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Input
          placeholder="Buyer / listing agent"
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
        />
        <Input
          placeholder="Seller's agent"
          value={sellerAgent}
          onChange={(e) => setSellerAgent(e.target.value)}
        />
        <Input
          placeholder="Property type"
          value={propertyType}
          onChange={(e) => setPropertyType(e.target.value)}
        />
        <Input
          placeholder="Size / sq ft"
          value={size}
          onChange={(e) => setSize(e.target.value)}
        />
        <Input
          type="date"
          value={closing}
          onChange={(e) => setClosing(e.target.value)}
          title="Closing date"
        />
        <Input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          title="Report due"
        />
        <Select
          value={projectId || "none"}
          onValueChange={(v) => setProjectId(v === "none" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Job" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No job</SelectItem>
            {jobs.map((j) => (
              <SelectItem key={j.id} value={j.id}>
                {j.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={add} disabled={saving || !title.trim()}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Build from findings"
          )}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Report</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Share</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <div className="font-medium">{r.title}</div>
                <div className="text-sm text-muted-foreground">
                  {[
                    r.project?.name,
                    r.property_type,
                    r.property_size,
                    r.agent_name ? `agent ${r.agent_name}` : null,
                    r.seller_agent_name
                      ? `seller agent ${r.seller_agent_name}`
                      : null,
                    r.contact ? contactDisplayName(r.contact) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </TableCell>
              <TableCell className="text-sm">
                {r.due_at ?? "—"}
                {r.closing_on ? ` · close ${r.closing_on}` : ""}
              </TableCell>
              <TableCell>
                <a
                  className="text-sm underline"
                  href={`/r/${r.share_token}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open link
                </a>
              </TableCell>
              <TableCell>
                <Select
                  value={r.status}
                  onValueChange={(v) => patch(r.id, { status: v })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {REPORT_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
