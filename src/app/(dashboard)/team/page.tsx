"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isCleaningWorkspace } from "@/lib/fieldService";
import type { TechnicianProfile } from "@/types/database";

export default function TeamFieldPage() {
  const { activeWorkspace } = useWorkspace();
  const [techs, setTechs] = useState<TechnicianProfile[]>([]);
  const [certs, setCerts] = useState("");
  const [expires, setExpires] = useState("");
  const [eoExpires, setEoExpires] = useState("");
  const [ceDue, setCeDue] = useState("");
  const [available, setAvailable] = useState(true);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const res = await fetch(
      `/api/technicians?workspaceId=${activeWorkspace.id}`
    );
    const json = await res.json();
    if (res.ok) setTechs(json.technicians ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function save() {
    if (!activeWorkspace) return;
    await fetch("/api/technicians", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        certifications: certs,
        license_expires: expires || null,
        eo_expires: eoExpires || null,
        ce_due_on: ceDue || null,
        available,
      }),
    });
    load();
  }

  const isCleaning = isCleaningWorkspace(activeWorkspace?.industry_preset);
  const teamLabel = isCleaning ? "Cleaners" : "Techs";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{teamLabel}</h1>
        <p className="text-muted-foreground">
          {isCleaning
            ? "Availability, background/training, and who can take the next clean. Assign the same cleaner on Recurring when the client prefers it."
            : "Availability, licenses, E&O, and CE dates before dispatch. Do not paste license numbers into Luna chat. Assign the inspector on the job."}
        </p>
      </div>
      <div className="max-w-md space-y-3">
        <div className="space-y-1">
          <Label>Your certifications / license</Label>
          <Input
            value={certs}
            onChange={(e) => setCerts(e.target.value)}
            placeholder="Pesticide, herbicide, CDL, …"
          />
        </div>
        <div className="space-y-1">
          <Label>License expires</Label>
          <Input
            type="date"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>E&O expires</Label>
          <Input
            type="date"
            value={eoExpires}
            onChange={(e) => setEoExpires(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>CE due</Label>
          <Input
            type="date"
            value={ceDue}
            onChange={(e) => setCeDue(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={available}
            onChange={(e) => setAvailable(e.target.checked)}
          />
          Available for dispatch
        </label>
        <Button onClick={save}>
          {isCleaning ? "Save my cleaner profile" : "Save my tech profile"}
        </Button>
      </div>
      <ul className="space-y-2 text-sm">
        {techs.map((t) => (
          <li key={t.id}>
            {t.available ? "Available" : "Unavailable"}
            {t.certifications ? ` · ${t.certifications}` : ""}
            {t.license_expires ? ` · lic exp ${t.license_expires}` : ""}
            {t.eo_expires ? ` · E&O exp ${t.eo_expires}` : ""}
            {t.ce_due_on ? ` · CE ${t.ce_due_on}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
