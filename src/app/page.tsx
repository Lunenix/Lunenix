import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed-in users go straight to the dashboard.
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Building2 className="h-7 w-7" />
      </div>
      <h1 className="mt-6 text-4xl font-bold tracking-tight">Lunenix</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        A private CRM &amp; business management platform for running your
        businesses in one place.
      </p>
      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/signup">Create account</Link>
        </Button>
      </div>
    </main>
  );
}
