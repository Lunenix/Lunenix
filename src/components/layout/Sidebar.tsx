"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddCompanyModal } from "@/components/workspace/AddCompanyModal";
import { ThemeToggleMenuItem } from "@/components/theme-toggle";
import { isFieldServiceWorkspace } from "@/lib/fieldService";
import { getVerticalPacks, shouldHideProjectsNav } from "@/lib/verticals/registry";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  ChevronsUpDown,
  ClipboardList,
  ClipboardSignature,
  FileSignature,
  FileText,
  FolderKanban,
  HardHat,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mail,
  MapPin,
  Package,
  Palette,
  Paintbrush,
  Bug,
  KeyRound,
  Plus,
  Receipt,
  Repeat,
  Settings,
  Shield,
  Truck,
  KanbanSquare,
  Users,
  Wrench,
  X,
  Zap,
  ClipboardCheck,
  Layers,
  Warehouse,
  CalendarRange,
  Cog,
  FilePen,
  UsersRound,
  ChartGantt,
  Notebook,
  Landmark,
  PencilRuler,
  TreePine,
  Hammer,
  Compass,
  Cylinder,
  Factory,
  Flame,
  PartyPopper,
  Wine,
  Martini,
  Images,
  ShieldCheck,
  ShoppingBag,
  UserRound,
  Camera,
  CalendarHeart,
  LayoutGrid,
  Wallet,
  Store,
  UserCheck,
  UserCog,
  Armchair,
  DoorOpen,
  CalendarCheck,
  ScrollText,
  Timer,
  CircleDollarSign,
  Sparkles,
  MapPinned,
  Shirt,
  Scissors,
  UtensilsCrossed,
  Soup,
  CookingPot,
  Thermometer,
} from "lucide-react";

const coreNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
];

const fieldNav = [
  { href: "/field", label: "Field ops", icon: Wrench },
  { href: "/estimates", label: "Estimates", icon: ClipboardSignature },
  { href: "/jobs", label: "Jobs", icon: FolderKanban },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/books", label: "Books", icon: BookOpen },
  { href: "/mileage", label: "Mileage", icon: MapPin },
  { href: "/permits", label: "Permits", icon: ClipboardList },
  { href: "/change-orders", label: "Change orders", icon: FilePen },
  { href: "/subs", label: "Subs", icon: UsersRound },
  { href: "/phases", label: "Phases", icon: ChartGantt },
  { href: "/daily-logs", label: "Daily logs", icon: Notebook },
  { href: "/draws", label: "Draws", icon: Landmark },
  { href: "/designs", label: "Designs", icon: PencilRuler },
  { href: "/selections", label: "Selections", icon: TreePine },
  { href: "/shop", label: "Shop", icon: Hammer },
  { href: "/drawings", label: "Drawings", icon: Compass },
  { href: "/specs", label: "Specs", icon: Cylinder },
  { href: "/fab", label: "Fab", icon: Factory },
  { href: "/welds", label: "Welds", icon: Flame },
  { href: "/claims", label: "Claims", icon: Shield },
  { href: "/materials", label: "Materials", icon: Truck },
  { href: "/colors", label: "Colors", icon: Palette },
  { href: "/prep", label: "Prep", icon: Paintbrush },
  { href: "/treatments", label: "Treatments", icon: Bug },
  { href: "/access", label: "Access", icon: KeyRound },
  { href: "/findings", label: "Findings", icon: ClipboardCheck },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/addons", label: "Add-ons", icon: Layers },
  { href: "/fleet", label: "Fleet", icon: Warehouse },
  { href: "/rentals", label: "Rentals", icon: CalendarRange },
  { href: "/maintenance", label: "Maintenance", icon: Cog },
  { href: "/plans", label: "Recurring", icon: Repeat },
  { href: "/team", label: "Techs", icon: HardHat },
];

const PACK_ICONS: Record<string, LucideIcon> = {
  Wine,
  PartyPopper,
  Martini,
  Images,
  ShieldCheck,
  ShoppingBag,
  UserRound,
  Camera,
  ClipboardSignature,
  Package,
  BookOpen,
  CalendarHeart,
  LayoutGrid,
  Wallet,
  Store,
  UserCheck,
  ChartGantt,
  UserCog,
  Armchair,
  Landmark,
  DoorOpen,
  CalendarCheck,
  ScrollText,
  Timer,
  CircleDollarSign,
  Cog,
  Sparkles,
  MapPinned,
  Shirt,
  Scissors,
  UsersRound,
  UtensilsCrossed,
  Soup,
  CookingPot,
  Thermometer,
  Warehouse,
};

const restNav = [
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/esign", label: "Contracts", icon: FileSignature },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/forms", label: "Forms", icon: ClipboardList },
  { href: "/emails", label: "Emails", icon: Mail },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/automation", label: "Automation", icon: Zap },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/settings/email", label: "Settings", icon: Settings },
  { href: "/settings/alerts", label: "Alerts", icon: Bell },
  { href: "/settings/workspaces", label: "Workspaces", icon: Building2 },
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
  const fieldService = isFieldServiceWorkspace(
    activeWorkspace?.industry_preset
  );
  const packNav = getVerticalPacks(activeWorkspace?.industry_preset)
    .filter((pack) => pack.id !== "field")
    .flatMap((pack) =>
      pack.nav.map((item) => ({
        href: item.href,
        label: item.label,
        icon: PACK_ICONS[item.icon] ?? ClipboardList,
      }))
    );
  const hideProjects = shouldHideProjectsNav(activeWorkspace?.industry_preset);
  const navItems = [
    ...coreNav,
    ...(fieldService ? fieldNav : []),
    ...packNav,
    ...restNav.filter((item) => !(hideProjects && item.href === "/projects")),
  ];
  const [unreadCount, setUnreadCount] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);

  // Poll the unread inbound-email count for the Inbox badge. Refreshes when the
  // workspace changes, on navigation, and every 60s.
  useEffect(() => {
    if (!activeWorkspace) {
      setUnreadCount(0);
      return;
    }
    let cancelled = false;

    async function loadCount() {
      try {
        const res = await fetch(
          `/api/emails/inbound/unread-count?workspaceId=${activeWorkspace!.id}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setUnreadCount(data.count || 0);
      } catch {
        /* non-fatal */
      }
    }

    loadCount();
    const interval = setInterval(loadCount, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeWorkspace, pathname]);

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
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push("/settings/workspaces")}
                className="cursor-pointer"
              >
                <Building2 className="mr-2 h-4 w-4" />
                Manage Workspaces
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowAddModal(true)}
                className="cursor-pointer"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Company
              </DropdownMenuItem>
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
                <span className="flex-1">{item.label}</span>
                {item.href === "/inbox" && unreadCount > 0 && (
                  <Badge
                    variant={active ? "secondary" : "default"}
                    className="ml-auto h-5 min-w-5 justify-center px-1.5 text-xs"
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Badge>
                )}
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
              <ThemeToggleMenuItem />
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

      <AddCompanyModal open={showAddModal} onOpenChange={setShowAddModal} />
    </>
  );
}
