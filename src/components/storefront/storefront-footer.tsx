"use client";

import { Store } from "lucide-react";
import { useStoreConfig } from "@/components/providers/config-provider";
import { useMoney } from "@/hooks/use-money";

/** Public storefront footer — sticks to bottom (layout uses min-h-screen flex-col).
 *  Branding comes from the shared Config context. */
export function StorefrontFooter() {
  const year = new Date().getFullYear();
  const { config } = useStoreConfig();
  const { currency, symbol } = useMoney();
  return (
    <footer className="mt-auto border-t border-border/60 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm">
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
            <span className="font-semibold">{config.storeName}</span>
            {config.subtitle ? (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{config.subtitle}</span>
              </>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            © {year} {config.storeName}. All prices in {currency} ({symbol}). Availability subject to stock.
          </p>
        </div>
      </div>
    </footer>
  );
}
