import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/auth/superAdmin";

/**
 * Luna (Gemini, Simli, ElevenLabs) is the platform owner's assistant only.
 * Other users will get a separate tenant assistant later.
 */
export async function requireSuperAdmin(): Promise<
  { user: User } | { error: NextResponse }
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!isSuperAdmin(user)) {
    return {
      error: NextResponse.json(
        { error: "Luna is only available to the platform owner." },
        { status: 403 }
      ),
    };
  }
  return { user };
}

/** Same as requireSuperAdmin. Prefer this name in new Luna routes. */
export const verifySuperAdmin = requireSuperAdmin;
