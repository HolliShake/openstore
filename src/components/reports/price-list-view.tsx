"use client";

/**
 * OpenStore — Printable customer price list (app view).
 * Route: /price-list
 *
 * Fetches public product data from /api/products and renders an A4-friendly,
 * two-column price list grouped by category. Fixed light palette for reliable
 * printing regardless of theme.
 */
import { useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORIES } from "@/lib/constants";
import { queryKeys } from "@/lib/query-client";
import { useStoreConfig } from "@/components/providers/config-provider";
import { useMoney } from "@/hooks/use-money";

type Product = {
  id: string;
  name: string;
  category: string;
  sellPrice: number;
};

export function PriceListView() {
  const { config } = useStoreConfig();
  const { money } = useMoney();
  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: queryKeys.products,
    queryFn: async () => {
      const r = await fetch("/api/products");
      if (!r.ok) throw new Error("Failed to load products");
      return r.json();
    },
  });

  useEffect(() => {
    document.title = `${config.storeName} — Price List`;
  }, [config.storeName]);

  const sections = CATEGORIES.map((cat) => ({
    ...cat,
    items: (products ?? []).filter((p) => p.category === cat.value),
  })).filter((s) => s.items.length > 0);

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* Screen-only toolbar */}
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back to store
          </Link>
          <Button onClick={() => window.print()} size="sm">
            <Printer className="mr-1 h-4 w-4" /> Print price list
          </Button>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-6 py-8 print:px-0 print:py-0">
        <header className="mb-6 text-center">
          <h1 className="text-3xl font-bold tracking-widest">{config.storeName.toUpperCase()}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Price List · Updated{" "}
            {new Date().toLocaleDateString("en-PH", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </header>

        {isLoading ? (
          <div className="space-y-6" aria-busy="true">
            <div className="flex items-center justify-center gap-2 text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading products…
            </div>
            {/* Skeleton mirrors the real 2-column price list layout */}
            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, sec) => (
                <div key={sec} className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  {Array.from({ length: 4 }).map((_, row) => (
                    <div key={row} className="flex items-center justify-between">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : sections.length === 0 ? (
          <p className="py-16 text-center text-sm text-zinc-400">
            No products yet — add products from the admin dashboard first.
          </p>
        ) : (
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 print:grid-cols-2">
            {sections.map((section) => (
              <section key={section.value} className="break-inside-avoid">
                <h2 className="mb-2 border-b-2 border-zinc-900 pb-1 text-sm font-bold">
                  {section.emoji} {section.label}
                </h2>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 text-zinc-500">
                      <th className="py-1 pr-2 font-medium">Item</th>
                      <th className="py-1 text-right font-medium">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.items.map((p) => (
                      <tr key={p.id} className="border-b border-dotted border-zinc-200">
                        <td className="py-1 pr-2">{p.name}</td>
                        <td className="py-1 text-right font-semibold tabular-nums">
                          {money(p.sellPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        )}

        <footer className="mt-10 border-t border-zinc-200 pt-3 text-center text-[10px] text-zinc-400">
          Prices may change without prior notice. Thank you for shopping at {config.storeName}!
        </footer>
      </main>
    </div>
  );
}
