"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CalendarDays,
  Check,
  ChevronsUpDown,
  ClipboardList,
  FileSignature,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mail,
  Receipt,
  Settings,
  KanbanSquare,
  Users,
  X,
  Zap,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/esign", label: "Contracts", icon: FileSignature },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/forms", label: "Forms", icon: ClipboardList },
  { href: "/emails", label: "Emails", icon: Mail },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/email-templates", label: "Email Templates", icon: Mail },
  { href: "/automation", label: "Automation", icon: Zap },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/settings/email", label: "Settings", icon: Settings },
];

interface SidebarProps {
  userEmail?: string | null;
  userName?: string | null;
  avatarUrl?: string | null;
  /** Mobile open state controlled by the dashboard layout. */
  isOpen?: boolean;
  onClose?: () => void;
}

function initialsOf(name?: string | null, email?: string | null) {
  const base = name?.trim() || email?.split("@")[0] || "U";
  const parts = base.split(/\s+/);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : base.slice(0, 2);
  return letters.toUpperCase();
}

export function Sidebar({
  userEmail,
  userName,
  avatarUrl,
  isOpen = false,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { workspaces, activeWorkspace, setActiveWorkspace, isLoading } =
    useWorkspace();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform duration-200 md:static md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Lunenix"
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-contain"
              priority
            />
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-semibold tracking-tight leading-none">
                Lunenix
              </span>
              <span className="text-xs text-muted-foreground leading-none mt-0.5">
                Business Hub
              </span>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Workspace switcher */}
        <div className="border-b border-border p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
                disabled={isLoading}
              >
                <span className="truncate">
                  {activeWorkspace?.name ??
                    (isLoading ? "Loading…" : "No workspace")}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
            >
              <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {workspaces.length === 0 && (
                <DropdownMenuItem disabled>No workspaces yet</DropdownMenuItem>
              )}
              {workspaces.map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => setActiveWorkspace(ws)}
                  className="cursor-pointer"
                >
                  <span className="truncate">{ws.name}</span>
                  {activeWorkspace?.id === ws.id && (
                    <Check className="ml-auto h-4 w-4" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User area */}
        <div className="border-t border-border p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex h-auto w-full items-center justify-start gap-3 px-2 py-2"
              >
                <Avatar className="h-8 w-8">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                  <AvatarFallback className="text-xs">
                    {initialsOf(userName, userEmail)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col items-start">
                  <span className="max-w-[9rem] truncate text-sm font-medium">
                    {userName || userEmail || "User"}
                  </span>
                  {userName && userEmail && (
                    <span className="max-w-[9rem] truncate text-xs text-muted-foreground">
                      {userEmail}
                    </span>
                  )}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="truncate">
                {userEmail}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}
