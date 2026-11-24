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
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Package,
  ScanLine,
  Truck,
  AlertTriangle,
  Wallet,
  FileText,
  Lightbulb,
  UserCog,
  Settings,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  DashboardLayout,
} from "@/components/admin/dashboard.layout";
import {
  type AdminSection,
  type AdminSectionId,
} from "@/components/admin/default.layout";

const SECTIONS: AdminSection[] = [
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
const CASHIER_SECTIONS: AdminSectionId[] = ["pos"];

export function AdminApp() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const { config } = useStoreConfig();

  const activeId = (params.get("tab") as AdminSectionId) ?? "dashboard";
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

  function go(id: AdminSectionId) {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", id);
    router.replace(`/admin?${url.searchParams.toString()}`);
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
    <DashboardLayout
      active={active}
      activeId={effectiveId}
      config={config}
      onSelect={go}
      role={role}
      sections={sections}
      username={session.user?.name ?? session.user?.username ?? "admin"}
    >
      <SectionRenderer id={effectiveId} />
    </DashboardLayout>
  );
}

function SectionRenderer({ id }: { id: AdminSectionId }) {
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
