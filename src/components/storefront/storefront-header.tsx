"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Store } from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { useStoreConfig } from "@/components/providers/config-provider";

/**
 * Public storefront header — sticky on top of the page.
 * Shows the store brand (name + subtitle + logo from the shared Config
 * context — falls back to the built-in Store icon when no brand image is
 * set), theme toggle, and a discreet "Admin" entry point.
 */
export function StorefrontHeader() {
  const { data: session } = useSession();
  const { config } = useStoreConfig();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          {config.brandImage ? (
            <img
              src={config.brandImage}
              alt={`${config.storeName} logo`}
              className="h-9 w-9 rounded-lg object-cover"
            />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Store className="h-5 w-5" />
            </span>
          )}
          <div className="leading-none">
            <div className="text-base font-bold tracking-tight">{config.storeName}</div>
            {config.subtitle ? (
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {config.subtitle}
              </div>
            ) : null}
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {session ? (
            <Button asChild size="sm">
              <Link href="/admin">Dashboard</Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/login">Admin</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
