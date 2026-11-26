"use client";

import { useState, type ReactNode, type ComponentType } from "react";
import Link from "next/link";
import {
  LogOut,
  Menu,
  Store,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { StoreConfig } from "@/components/providers/config-provider";

export type AdminSectionId =
  | "dashboard"
  | "inventory"
  | "pos"
  | "stock-in"
  | "losses"
  | "expenses"
  | "insights"
  | "reports"
  | "cashiers"
  | "settings"
  | "profile";

export type AdminSection = {
  id: AdminSectionId;
  label: string;
  icon: ComponentType<{ className?: string }>;
  description: string;
};

export type DefaultLayoutProps = {
  active: AdminSection;
  activeId: AdminSectionId;
  config: StoreConfig;
  configLoading: boolean;
  role: string;
  sections: AdminSection[];
  username: string;
  children: ReactNode;
};

export function DefaultLayout({
  active,
  activeId,
  config,
  role,
  configLoading,
  sections,
  username,
  children,
}: DefaultLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  function closeMobileNav() {
    setMobileNavOpen(false);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur sm:px-6">
        <div className="flex items-center gap-2">
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
                <SheetTitle
                  className="flex items-center gap-2 text-left"
                  aria-busy={configLoading}
                >
                  <BrandLogo
                    config={config}
                    loading={configLoading}
                    className="h-7 w-7"
                  />
                  <StoreName config={config} loading={configLoading} />
                </SheetTitle>
              </SheetHeader>
              <NavList
                activeId={activeId}
                onNavigate={closeMobileNav}
                username={username}
                role={role}
                sections={sections}
              />
            </SheetContent>
          </Sheet>

          <BrandLogo
            config={config}
            loading={configLoading}
            className="h-8 w-8"
          />
          <div className="leading-none">
            <div
              className="flex items-center gap-1 text-sm font-semibold"
              aria-busy={configLoading}
            >
              <StoreName config={config} loading={configLoading} />
              <span>{role === "cashier" ? "Cashier" : "Admin"}</span>
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
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 self-start overflow-y-auto border-r bg-muted/20 md:block">
          <NavList
            activeId={activeId}
            onNavigate={closeMobileNav}
            username={username}
            role={role}
            sections={sections}
          />
        </aside>
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}

function BrandLogo({
  config,
  loading,
  className,
}: {
  config: StoreConfig;
  loading: boolean;
  className: string;
}) {
  if (loading) {
    return (
      <span
        aria-hidden="true"
        className={cn("shrink-0 animate-pulse rounded-md bg-muted", className)}
      />
    );
  }

  if (config.brandImage) {
    return (
      <img
        src={config.brandImage}
        alt=""
        className={cn("shrink-0 rounded-md object-cover", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground",
        className,
      )}
    >
      <Store className="h-4 w-4" />
    </span>
  );
}

function StoreName({
  config,
  loading,
}: {
  config: StoreConfig;
  loading: boolean;
}) {
  if (loading) {
    return (
      <>
        <span
          aria-hidden="true"
          className="inline-block h-4 w-24 animate-pulse rounded bg-muted"
        />
        <span className="sr-only">Loading store name</span>
      </>
    );
  }

  return <span>{config.storeName}</span>;
}

function NavList({
  activeId,
  onNavigate,
  username,
  role,
  sections,
}: {
  activeId: AdminSectionId;
  onNavigate: () => void;
  username: string;
  role: string;
  sections: AdminSection[];
}) {
  return (
    <nav className="flex h-full flex-col gap-1 p-3">
      <div className="space-y-1">
        <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {role === "cashier" ? "Workspace" : "Manage"}
        </p>
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeId === section.id;
          return (
            <Link
              key={section.id}
              href={section.id === "dashboard" ? "/admin" : `/admin/${section.id}`}
              onClick={onNavigate}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                isActive &&
                  "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground shadow-sm",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{section.label}</span>
            </Link>
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
