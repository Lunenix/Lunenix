import type { User } from "@supabase/supabase-js";

/** Existing platform flag in auth app_metadata. Do not set or clear it here. */
export function isSuperAdmin(
  user: Pick<User, "app_metadata"> | null | undefined
): boolean {
  return (
    (user?.app_metadata as { is_super_admin?: boolean } | null)
      ?.is_super_admin === true
  );
}
