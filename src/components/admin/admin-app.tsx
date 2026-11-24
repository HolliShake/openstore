"use client";

/**
 * OpenStore — Admin shell.
 *
 * The shell wraps the admin experience: a responsive sidebar with section
 * navigation, a topbar (theme toggle, store link, sign-out), and a content
 * area that renders the active section. The active section is driven by the
 * `tab` URL search param so it survives reloads and is shareable.
 *
 * The section components are lazy-rendered to keep the bundle per view small.
 */
import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Package,
  ScanLine,
  Truck,
  AlertTriangle,
  Wallet,
  FileText,
  ListOrdered,
  Store,
  LogOut,
  Menu,
  Lightbulb,
  UserCog,
  Settings,
} from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { AdminDashboard } from "@/components/admin/sections/admin-dashboard";
import { AdminInventory } from "@/components/admin/sections/admin-inventory";
import { AdminPOS } from "@/components/admin/sections/admin-pos";
import { AdminStockIn } from "@/components/admin/sections/admin-stock-in";
import { AdminLosses } from "@/components/admin/sections/admin-losses";
import { AdminExpenses } from "@/components/admin/sections/admin-expenses";
import { AdminReports } from "@/components/admin/sections/admin-reports";
import { AdminInsights } from "@/components/admin/sections/admin-insights";
import { AdminCashiers } from "@/components/admin/sections/admin-cashiers";
import { AdminSettings } from "@/components/admin/sections/admin-settings";
import { useStoreConfig } from "@/components/providers/config-provider";

type SectionId =
  | "dashboard"
  | "inventory"
  | "pos"
  | "stock-in"
  | "losses"
  | "expenses"
  | "insights"
  | "reports"
  | "cashiers"
  | "settings";

const SECTIONS: {
  id: SectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, description: "Weekly KPIs & charts" },
  { id: "inventory", label: "Inventory", icon: Package, description: "Products CRUD" },
  { id: "pos", label: "POS / Checkout", icon: ScanLine, description: "Record a sale" },
  { id: "stock-in", label: "Stock-in", icon: Truck, description: "Record restock" },
  { id: "losses", label: "Losses", icon: AlertTriangle, description: "Spoilage / damage" },
  { id: "expenses", label: "Expenses", icon: Wallet, description: "Non-COGS costs" },
  { id: "insights", label: "Insights", icon: Lightbulb, description: "Best & slow sellers" },
  { id: "reports", label: "Reports", icon: FileText, description: "Printable weekly & price list" },
  { id: "cashiers", label: "Cashiers", icon: UserCog, description: "Add & manage cashier accounts" },
  { id: "settings", label: "Settings", icon: Settings, description: "Store name, images & tagline" },
];

/** Sections a cashier may see — POS checkout only. */
const CASHIER_SECTIONS: SectionId[] = ["pos"];

export function AdminApp() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const { config } = useStoreConfig();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const activeId = (params.get("tab") as SectionId) ?? "dashboard";
  const role = session?.user?.role ?? "admin";
  const isCashier = role === "cashier";
  // Cashiers are locked to the POS section; any other tab param is ignored.
  const allowedIds = isCashier ? CASHIER_SECTIONS : SECTIONS.map((s) => s.id);
  const effectiveId = allowedIds.includes(activeId) ? activeId : allowedIds[0];

  // Guard: redirect to login if unauthenticated. We only redirect when status
  // settles on "unauthenticated" — never on "loading" — so a brief session
  // flicker (common right after sign-in while the cookie propagates) cannot
  // bounce the user back to the login screen.
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  function go(id: SectionId) {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", id);
    router.replace(`/admin?${url.searchParams.toString()}`);
    setMobileNavOpen(false);
  }

  if (status === "loading" || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }

  const active = SECTIONS.find((s) => s.id === effectiveId) ?? SECTIONS[0];
  const sections = SECTIONS.filter((s) => allowedIds.includes(s.id));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Topbar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur sm:px-6">
        <div className="flex items-center gap-2">
          {/* Mobile nav trigger */}
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="px-4 py-4">
                <SheetTitle className="flex items-center gap-2 text-left">
                  {config.brandImage ? (
                    <img
                      src={config.brandImage}
                      alt=""
                      className="h-7 w-7 rounded-md object-cover"
                    />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                      <Store className="h-4 w-4" />
                    </span>
                  )}
                  {config.storeName}
                </SheetTitle>
              </SheetHeader>
              <NavList
                activeId={effectiveId}
                onSelect={go}
                username={session.user?.name ?? session.user?.username ?? "admin"}
                role={role}
                sections={sections}
              />
            </SheetContent>
          </Sheet>

          {config.brandImage ? (
            <img
              src={config.brandImage}
              alt=""
              className="h-8 w-8 rounded-md object-cover"
            />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Store className="h-4 w-4" />
            </span>
          )}
          <div className="leading-none">
            <div className="text-sm font-semibold">
              {isCashier ? `${config.storeName} Cashier` : `${config.storeName} Admin`}
            </div>
            <div className="hidden text-[10px] text-muted-foreground sm:block">
              {active.description}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/">View store</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/" })}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 border-r bg-muted/20 md:block">
          <NavList
            activeId={effectiveId}
            onSelect={go}
            username={session.user?.name ?? session.user?.username ?? "admin"}
            role={role}
            sections={sections}
          />
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
            <SectionRenderer id={effectiveId} />
          </div>
        </main>
      </div>
    </div>
  );
}

function NavList({
  activeId,
  onSelect,
  username,
  role,
  sections,
}: {
  activeId: SectionId;
  onSelect: (id: SectionId) => void;
  username: string;
  role: string;
  sections: typeof SECTIONS;
}) {
  return (
    <nav className="flex h-full flex-col gap-1 p-3">
      <div className="space-y-1">
        <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {role === "cashier" ? "Checkout" : "Manage"}
        </p>
        {sections.map((s) => {
          const Icon = s.icon;
          const isActive = activeId === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                isActive && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground shadow-sm",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-auto rounded-lg border border-border/60 p-3 text-xs text-muted-foreground">
        Signed in as
        <div className="mt-0.5 truncate font-medium text-foreground">{username}</div>
        <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {role === "cashier" ? "Cashier" : "Admin"}
        </div>
      </div>
    </nav>
  );
}

function SectionRenderer({ id }: { id: SectionId }) {
  switch (id) {
    case "dashboard":
      return <AdminDashboard />;
    case "inventory":
      return <AdminInventory />;
    case "pos":
      return <AdminPOS />;
    case "stock-in":
      return <AdminStockIn />;
    case "losses":
      return <AdminLosses />;
    case "expenses":
      return <AdminExpenses />;
    case "insights":
      return <AdminInsights />;
    case "reports":
      return <AdminReports />;
    case "cashiers":
      return <AdminCashiers />;
    case "settings":
      return <AdminSettings />;
    default:
      return <AdminDashboard />;
  }
}
