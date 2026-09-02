"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TechnicianProfile } from "@/types/database";

export default function TeamFieldPage() {
  const { activeWorkspace } = useWorkspace();
  const [techs, setTechs] = useState<TechnicianProfile[]>([]);
  const [certs, setCerts] = useState("");
  const [expires, setExpires] = useState("");
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
        available,
      }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Techs</h1>
        <p className="text-muted-foreground">
          Availability and license/cert notes before dispatch. Assign the tech
          on the job (project) record.
        </p>
      </div>
      <div className="max-w-md space-y-3">
        <div className="space-y-1">
          <Label>Your certifications / license</Label>
          <Input value={certs} onChange={(e) => setCerts(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>License expires</Label>
          <Input
            type="date"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
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
        <Button onClick={save}>Save my tech profile</Button>
      </div>
      <ul className="space-y-2 text-sm">
        {techs.map((t) => (
          <li key={t.id}>
            {t.available ? "Available" : "Unavailable"}
            {t.certifications ? ` · ${t.certifications}` : ""}
            {t.license_expires ? ` · exp ${t.license_expires}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
