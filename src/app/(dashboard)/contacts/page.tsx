import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ContactsTable } from "@/components/contacts/ContactsTable";
import { ContactsPageClient } from "./ContactsPageClient";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: { workspaceId?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const requested =
    typeof searchParams.workspaceId === "string"
      ? searchParams.workspaceId.trim()
      : "";

  if (requested) {
    const { data: member } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", requested)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!member?.workspace_id) {
      redirect("/dashboard");
    }

    return (
      <div className="space-y-6">
        <ContactsTable workspaceId={member.workspace_id} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ContactsPageClient />
    </div>
  );
}
