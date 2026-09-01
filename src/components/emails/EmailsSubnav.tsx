"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/emails", label: "History", match: (path: string) => path === "/emails" },
  {
    href: "/emails/templates",
    label: "Templates",
    match: (path: string) => path.startsWith("/emails/templates"),
  },
];

export function EmailsSubnav() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1 w-fit">
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
