import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

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
      <Image
        src="/logo.png"
        alt="Lunenix"
        width={112}
        height={112}
        className="h-28 w-28 rounded-full object-contain"
        priority
      />
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
