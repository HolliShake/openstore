"use client";

/**
 * OpenStore — Printable grocery / restock list (app view).
 * Route: /restock-list?weeks=4&coverDays=14
 *
 * Fetches /api/restock-list (admin-gated) and renders a print-optimised
 * shopping list. Items are grouped by priority (out of stock first, then
 * urgent, then buy-this-trip, then optional) and within each group sorted by
 * sales speed — fastest sellers on top, so a quick grocery run just works
 * top-to-bottom. Checkboxes are plain bordered squares that tick well with
 * a pen on paper and still render when printing.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Printer, Loader2, Lock, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { categoryEmoji, categoryLabel } from "@/lib/constants";
import { useStoreConfig } from "@/components/providers/config-provider";
import { useMoney } from "@/hooks/use-money";

type RestockItem = {
  productId: string;
  name: string;
  category: string;
  currentStock: number;
  lowStockThreshold: number;
  unitCost: number;
  unitsSold: number;
  unitsPerWeek: number;
  daysLeft: number | null;
  priority: "critical" | "high" | "medium" | "low";
  suggestedQty: number;
  estCost: number;
  reason: string;
};

type RestockData = {
  generatedAt: string;
  weeks: number;
  coverDays: number;
  summary: {
    itemCount: number;
    totalUnits: number;
    totalEstCost: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  items: RestockItem[];
};

const GROUPS = [
  {
    key: "critical" as const,
    title: "Buy first — out of stock",
    hint: "You are losing sales on these right now.",
    dot: "bg-red-600",
  },
  {
    key: "high" as const,
    title: "Urgent — running out within a week",
    hint: "Fast sellers and low-stock items; buy these before anything else below.",
    dot: "bg-orange-500",
  },
  {
    key: "medium" as const,
    title: "Buy on this trip",
    hint: "Stock will run out before your next likely grocery run.",
    dot: "bg-amber-400",
  },
  {
    key: "low" as const,
    title: "If budget allows",
    hint: "Not urgent, but topping up now saves a trip later.",
    dot: "bg-zinc-400",
  },
];

export function RestockListView() {
  const { config } = useStoreConfig();
  const { money } = useMoney();
  const params = useSearchParams();
  const weeks = params.get("weeks") ?? "4";
  const coverDays = params.get("coverDays") ?? "14";
  // Ticked items (screen-only convenience; prints as ticked too).
  const [ticked, setTicked] = useState<Record<string, boolean>>({});

  const { data, isLoading, isError, error } = useQuery<RestockData>({
    queryKey: ["restock-list", weeks, coverDays],
    queryFn: async () => {
      const r = await fetch(`/api/restock-list?weeks=${weeks}&coverDays=${coverDays}`);
      if (r.status === 401) throw new Error("UNAUTHORIZED");
      if (!r.ok) throw new Error("Failed to load restock list");
      return r.json();
    },
    retry: false,
  });

  useEffect(() => {
    document.title = `${config.storeName} — Grocery / Restock List`;
  }, [config.storeName]);

  if (isError && error.message === "UNAUTHORIZED") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-4 text-zinc-900">
        <Lock className="h-8 w-8 text-zinc-400" />
        <h1 className="text-lg font-semibold">Sign in required</h1>
        <p className="text-sm text-zinc-500">
          The grocery list is built from your store&apos;s sales data.
        </p>
        <Button asChild>
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(
              `/restock-list?weeks=${weeks}&coverDays=${coverDays}`,
            )}`}
          >
            Go to sign in
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* Screen-only toolbar */}
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            href="/admin/inventory"
            className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back to admin
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTicked({})}
              className="text-zinc-500"
            >
              Clear ticks
            </Button>
            <Button onClick={() => window.print()} size="sm">
              <Printer className="mr-1 h-4 w-4" /> Print grocery list
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-6 py-8 print:px-0 print:py-0">
        {isLoading || !data ? (
          <div className="space-y-3" aria-busy="true">
            <div className="flex items-center justify-center gap-2 text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Building your grocery list…
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        ) : data.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <ShoppingCart className="h-10 w-10 text-zinc-300" />
            <p className="text-sm font-medium">Nothing to buy — stock is healthy</p>
            <p className="max-w-sm text-xs text-zinc-400">
              Based on the last {data.weeks} week{data.weeks > 1 ? "s" : ""} of sales, every
              product has enough stock to last the next {data.coverDays} days. Check back
              after your next sales.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <header className="mb-5">
              <h1 className="text-2xl font-bold tracking-tight">
                {config.storeName} — Grocery / Restock List
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Generated {formatDate(data.generatedAt)} · based on sales from the last{" "}
                {data.weeks} week{data.weeks > 1 ? "s" : ""} · buy quantities target{" "}
                {data.coverDays} days of stock
              </p>
              {/* Summary strip */}
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md border border-zinc-200 px-2 py-2">
                  <div className="text-lg font-bold tabular-nums">{data.summary.itemCount}</div>
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                    items to buy
                  </div>
                </div>
                <div className="rounded-md border border-zinc-200 px-2 py-2">
                  <div className="text-lg font-bold tabular-nums">
                    {data.summary.totalUnits}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                    total units
                  </div>
                </div>
                <div className="rounded-md border border-zinc-200 px-2 py-2">
                  <div className="text-lg font-bold tabular-nums">
                    {money(data.summary.totalEstCost)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                    estimated budget
                  </div>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-zinc-400 print:hidden">
                Sorted by urgency, then by how fast each item sells — fastest sellers are on
                top of each group. Tick items as you put them in the cart.
              </p>
            </header>

            {/* Priority groups */}
            <div className="space-y-5">
              {GROUPS.map((group) => {
                const items = data.items.filter((i) => i.priority === group.key);
                if (items.length === 0) return null;
                return (
                  <section key={group.key} className="break-inside-avoid">
                    <div className="mb-1 flex items-center gap-2 border-b-2 border-zinc-900 pb-1">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${group.dot}`} />
                      <h2 className="text-sm font-bold uppercase tracking-wide">
                        {group.title}
                      </h2>
                      <span className="text-[11px] font-normal text-zinc-500">
                        ({items.length})
                      </span>
                    </div>
                    <p className="mb-2 text-[11px] text-zinc-500">{group.hint}</p>
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-zinc-200 text-zinc-500">
                          <th className="w-7 py-1 font-medium"></th>
                          <th className="py-1 pr-2 font-medium">Item</th>
                          <th className="py-1 text-right font-medium">In stock</th>
                          <th className="py-1 text-center font-medium">Buy</th>
                          <th className="py-1 text-right font-medium">Est. cost</th>
                          <th className="hidden py-1 pl-3 font-medium sm:table-cell print:table-cell">
                            Why
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr
                            key={item.productId}
                            className="cursor-pointer border-b border-dotted border-zinc-200"
                            onClick={() =>
                              setTicked((t) => ({ ...t, [item.productId]: !t[item.productId] }))
                            }
                          >
                            <td className="py-1.5">
                              <span
                                className={`inline-flex h-4 w-4 items-center justify-center border ${
                                  ticked[item.productId]
                                    ? "border-zinc-900 bg-zinc-900 text-[10px] font-bold text-white"
                                    : "border-zinc-400 bg-white"
                                }`}
                                aria-label={
                                  ticked[item.productId] ? "In cart" : "Not in cart yet"
                                }
                              >
                                {ticked[item.productId] ? "✓" : ""}
                              </span>
                            </td>
                            <td className="py-1.5 pr-2">
                              <span className="font-medium">{item.name}</span>
                              <span className="ml-1 text-[10px] text-zinc-400">
                                {categoryEmoji(item.category)}{" "}
                                <span className="hidden sm:inline print:inline">
                                  {categoryLabel(item.category)}
                                </span>
                              </span>
                            </td>
                            <td className="py-1.5 text-right tabular-nums text-zinc-600">
                              {item.currentStock}
                            </td>
                            <td className="py-1.5 text-center text-sm font-bold tabular-nums">
                              {item.suggestedQty}
                            </td>
                            <td className="py-1.5 text-right tabular-nums">
                              {item.unitCost > 0 ? money(item.estCost) : "—"}
                            </td>
                            <td className="hidden py-1.5 pl-3 text-[10px] text-zinc-500 sm:table-cell print:table-cell">
                              {item.reason}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                );
              })}
            </div>

            <footer className="mt-8 border-t border-zinc-200 pt-3 text-center text-[10px] text-zinc-400">
              Buy quantities are suggestions based on recent sales — adjust to fit your
              budget. Est. costs use your latest weighted-average purchase cost per item.
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
