import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Add super-admins to workspaces they are missing from.
 * Never updates an existing membership role or other workspace settings.
 */
export async function grantMissingSuperAdminMemberships(
  admin: SupabaseClient
): Promise<void> {
  const superIds = await listSuperAdminUserIds(admin);
  if (!superIds.length) return;

  const { data: workspaces } = await admin.from("workspaces").select("id");
  const { data: memberships } = await admin
    .from("workspace_members")
    .select("workspace_id, user_id")
    .in("user_id", superIds);

  const have = new Set(
    (memberships ?? []).map((m) => `${m.workspace_id}:${m.user_id}`)
  );
  const rows: { workspace_id: string; user_id: string; role: string }[] = [];
  for (const ws of workspaces ?? []) {
    if (typeof ws.id !== "string") continue;
    for (const userId of superIds) {
      if (!have.has(`${ws.id}:${userId}`)) {
        rows.push({ workspace_id: ws.id, user_id: userId, role: "owner" });
      }
    }
  }
  if (!rows.length) return;
  await admin.from("workspace_members").insert(rows);
}

export async function ensureSuperAdminMembership(
  admin: SupabaseClient,
  userId: string,
  workspaceId: string
): Promise<void> {
  const { data } = await admin
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.id) return;
  await admin.from("workspace_members").insert({
    workspace_id: workspaceId,
    user_id: userId,
    role: "owner",
  });
}

async function listSuperAdminUserIds(admin: SupabaseClient): Promise<string[]> {
  const ids: string[] = [];
  let page = 1;
  for (;;) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users ?? [];
    if (!users.length) break;
    for (const u of users) {
      const flag =
        (u.app_metadata as { is_super_admin?: boolean } | null)
          ?.is_super_admin === true;
      if (flag) ids.push(u.id);
    }
    if (users.length < 200) break;
    page += 1;
  }
  return ids;
}
