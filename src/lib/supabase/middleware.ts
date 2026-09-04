import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Public route prefixes that never require authentication.
 */
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/auth",
  "/",
  // Public form pages + their API.
  "/f",
  "/api/forms",
  // Public e-signature signing pages + their API (tokenized, no auth).
  "/sign",
  "/api/sign",
  // Public inspection report links (tokenized, no auth).
  "/r",
  "/api/inspection-reports/share",
  // Cron jobs (protected by CRON_SECRET, not a session cookie).
  "/api/esign/reminders/run",
  "/api/emails/scheduled/run",
  "/api/emails/inbound/run",
  "/api/email-drafts/run",
  "/api/tasks/reminders/run",
  "/api/service-plans/run",
  "/api/telegram/test",
  "/api/telegram/webhook",
  // Stripe Checkout webhooks (signed by Stripe, no session cookie).
  "/api/billing/stripe/webhook",
];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PATHS.some(
    (p) => p !== "/" && (pathname === p || pathname.startsWith(`${p}/`))
  );
}

/**
 * Refreshes the Supabase auth session (if any) and enforces route protection.
 *
 * - Refreshes the session cookie so Server Components see a valid session.
 * - Redirects unauthenticated users away from protected routes to /login.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase env vars are missing at runtime (e.g. not configured in the
  // deployment platform), do NOT crash the middleware with a 500. Let the
  // request pass through so pages can render / show a config error instead.
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "[middleware] Missing Supabase env vars: " +
        `NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl ? "set" : "MISSING"}, ` +
        `NEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseAnonKey ? "set" : "MISSING"}`
    );
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do not run code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protect everything under /dashboard.
  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  // If a logged-in user hits an auth page, send them to the dashboard.
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
