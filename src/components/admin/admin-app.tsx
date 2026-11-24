"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
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
import { useStoreConfig } from "@/components/providers/config-provider";
import { DashboardLayout } from "@/components/admin/dashboard.layout";
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
  { id: "expenses", label: "Expenses", icon: Wallet, description: "Rent, utilities & supplies" },
  { id: "insights", label: "Insights", icon: Lightbulb, description: "Best & slow sellers" },
  { id: "reports", label: "Reports", icon: FileText, description: "Printable weekly & price list" },
  { id: "cashiers", label: "Cashiers", icon: UserCog, description: "Add & manage cashier accounts" },
  { id: "settings", label: "Settings", icon: Settings, description: "Store name, images & tagline" },
];

export function AdminApp({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { config } = useStoreConfig();

  const sectionSlug = pathname.split("/")[2];
  const activeId =
    SECTIONS.find((section) => section.id === sectionSlug)?.id ?? "dashboard";
  const role = session?.user?.role ?? "admin";
  const isCashier = role === "cashier";
  const sections = isCashier ? SECTIONS.filter((section) => section.id === "pos") : SECTIONS;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    } else if (status === "authenticated" && isCashier && activeId !== "pos") {
      router.replace("/admin/pos");
    }
  }, [status, isCashier, activeId, router]);

  if (status === "loading" || !session || (isCashier && activeId !== "pos")) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }

  const active = SECTIONS.find((section) => section.id === activeId) ?? SECTIONS[0];

  return (
    <DashboardLayout
      active={active}
      activeId={activeId}
      config={config}
      role={role}
      sections={sections}
      username={session.user?.name ?? session.user?.username ?? "admin"}
    >
      {children}
    </DashboardLayout>
  );
}
