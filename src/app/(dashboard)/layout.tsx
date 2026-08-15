import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Auth guard — middleware also enforces this, but double-check here.
  if (!user) {
    redirect("/login");
  }

  // Fetch the user's profile for display in the shell.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const userName =
    profile?.full_name ??
    (user.user_metadata?.full_name as string | undefined) ??
    null;
  const avatarUrl =
    profile?.avatar_url ??
    (user.user_metadata?.avatar_url as string | undefined) ??
    null;

  return (
    <DashboardShell
      userEmail={user.email}
      userName={userName}
      avatarUrl={avatarUrl}
    >
      {children}
    </DashboardShell>
  );
}
