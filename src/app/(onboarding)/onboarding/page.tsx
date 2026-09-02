"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceOnboardingForm } from "@/components/workspace/CreateWorkspaceForm";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [adminTier, setAdminTier] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const res = await fetch("/api/workspaces");
      const json = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (res.ok && Array.isArray(json.workspaces) && json.workspaces.length > 0) {
        router.replace("/dashboard");
        return;
      }
      setAdminTier(Boolean(json.unlimited_workspaces));
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <WorkspaceOnboardingForm
      adminTier={adminTier}
      onCreated={() => window.location.assign("/dashboard")}
    />
  );
}
