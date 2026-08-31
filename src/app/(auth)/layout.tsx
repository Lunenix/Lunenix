import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
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
            Business Hub
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
