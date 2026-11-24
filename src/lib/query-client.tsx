/**
 * OpenStore — TanStack Query client + provider.
 * Single shared QueryClient keyed by route; mutations invalidate query keys.
 */
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/** Centralised query keys so mutation invalidation stays DRY. */
export const queryKeys = {
  products: ["products"] as const,
  product: (id: string) => ["product", id] as const,
  sales: ["sales"] as const,
  stockIns: ["stock-ins"] as const,
  losses: ["losses"] as const,
  expenses: ["expenses"] as const,
  dashboard: (range?: string) => ["dashboard", range ?? "current"] as const,
  reportsWeekly: (offsetWeeks: number) => ["reports", "weekly", offsetWeeks] as const,
  users: ["users"] as const,
  config: ["config"] as const,
} as const;

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
