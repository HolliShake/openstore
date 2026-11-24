"use client";

/**
 * OpenStore — public storefront.
 * This is what customers see when they visit the store's public link.
 *
 * Sections:
 *  - Header (brand, theme, admin entry)
 *  - Hero (store name, tagline, product count)
 *  - Search + category filter chips
 *  - Responsive product grid using ProductCard
 *  - Footer (sticky)
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ShoppingBasket, Sparkles } from "lucide-react";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";
import { ProductCard, type StoreProduct } from "@/components/storefront/product-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { queryKeys } from "@/lib/query-client";
import { CATEGORIES } from "@/lib/constants";
import { useStoreConfig } from "@/components/providers/config-provider";
import { cn } from "@/lib/utils";

type ProductListResponse = StoreProduct[];

export function StorefrontView() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const { config } = useStoreConfig();

  const { data: products, isLoading } = useQuery<ProductListResponse>({
    queryKey: queryKeys.products,
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to load products");
      return res.json() as Promise<ProductListResponse>;
    },
  });

  const visible = useMemo(() => {
    if (!products) return [];
    return products.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !(p.description ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [products, query, category]);

  const inStockCount = products?.filter((p) => p.stock > 0).length ?? 0;

  return (
    <div className="flex min-h-screen flex-col">
      <StorefrontHeader />

      <main className="flex-1">
        {/* Hero — bannerImage from store config if set, else default gradient */}
        <section
          className={cn(
            "relative border-b border-border/60",
            !config.bannerImage && "bg-gradient-to-b from-muted/50 to-background",
          )}
          style={
            config.bannerImage
              ? {
                  backgroundImage: `url(${config.bannerImage})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          {config.bannerImage ? (
            // readability scrim over the custom banner photo
            <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px]" />
          ) : null}
          <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="flex flex-col items-start gap-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-1 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                Fresh stock every week
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
                {config.storeName}
                {config.subtitle ? (
                  <span className="block text-base font-normal text-muted-foreground sm:text-lg">
                    {config.subtitle}
                  </span>
                ) : null}
              </h1>
              {config.welcomeText ? (
                <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                  {config.welcomeText}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-3 text-xs">
                {isLoading ? (
                  /* Skeleton stat chips while products load */
                  <>
                    <Skeleton className="h-7 w-28 rounded-full" />
                    <Skeleton className="h-7 w-32 rounded-full" />
                  </>
                ) : (
                  <>
                    <Stat
                      icon={<ShoppingBasket className="h-3.5 w-3.5" />}
                      label={`${products?.length ?? 0} products`}
                    />
                    <Stat label={`${inStockCount} available now`} />
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Controls */}
        <section className="sticky top-16 z-30 border-b border-border/60 bg-background/90 backdrop-blur-md">
          <div className="mx-auto max-w-7xl space-y-3 px-4 py-3 sm:px-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products…"
                className="pl-9"
                aria-label="Search products"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <CategoryChip
                active={category === "all"}
                onClick={() => setCategory("all")}
                label="All"
              />
              {CATEGORIES.map((c) => (
                <CategoryChip
                  key={c.value}
                  active={category === c.value}
                  onClick={() => setCategory(c.value)}
                  label={`${c.emoji} ${c.label}`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Grid */}
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          {isLoading ? (
            <ProductGridSkeleton />
          ) : visible.length === 0 ? (
            <EmptyState query={query} />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {visible.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>
      </main>

      <StorefrontFooter />
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      onClick={onClick}
      className={cn("h-8 rounded-full px-3 text-xs", active && "shadow-sm")}
    >
      {label}
    </Button>
  );
}

function Stat({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-3 py-1 text-muted-foreground">
      {icon}
      {label}
    </span>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <Skeleton key={i} className="h-64 w-full rounded-xl" />
      ))}
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <p className="text-lg font-medium">No products found</p>
      <p className="text-sm text-muted-foreground">
        {query
          ? `Nothing matches "${query}". Try a different search.`
          : "Inventory is empty. Add products from the admin dashboard."}
      </p>
    </div>
  );
}
