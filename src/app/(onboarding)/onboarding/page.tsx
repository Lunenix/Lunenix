"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceOnboardingForm } from "@/components/workspace/CreateWorkspaceForm";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

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
      const { data } = await supabase
        .from("workspace_members")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);
      if (cancelled) return;
      if (data && data.length > 0) {
        router.replace("/dashboard");
        return;
      }
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
      onCreated={() => window.location.assign("/dashboard")}
    />
  );
}
