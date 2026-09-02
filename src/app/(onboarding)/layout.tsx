import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/logo.png"
            alt="Lunenix"
            width={96}
            height={96}
            className="mb-3 h-24 w-24 rounded-full object-contain"
            priority
          />
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Lunenix
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set up your workspace
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
