"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { categoryEmoji, categoryLabel } from "@/lib/constants";
import { useMoney } from "@/hooks/use-money";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

export type StoreProduct = {
  id: string;
  name: string;
  category: string;
  sellPrice: number;
  stock: number;
  lowStockThreshold: number;
  imageUrl: string | null;
  imageData: string | null;
  description: string | null;
};

/**
 * OpenStore — beautiful product card for the public storefront.
 * UI/UX principles applied:
 *  - Visual hierarchy: image → name → price → meta
 *  - Affordance: clear stock state with color-coded badge
 *  - Feedback: subtle hover lift + image zoom
 *  - Accessibility: alt text, semantic structure, sufficient contrast
 */
export function ProductCard({ product }: { product: StoreProduct }) {
  const { money } = useMoney(); // configured currency (Config → Settings)
  const stockState = deriveStockState(product.stock, product.lowStockThreshold);
  const imgSrc = product.imageData ?? product.imageUrl;

  return (
    <Card
      className={cn(
        "group relative overflow-hidden p-0 transition-all duration-300",
        "hover:-translate-y-1 hover:shadow-lg hover:border-primary/40",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
      )}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={product.name}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
            <Package className="h-12 w-12" strokeWidth={1.2} />
          </div>
        )}
        {/* Category badge */}
        <div className="absolute left-2 top-2">
          <Badge
            variant="secondary"
            className="bg-background/80 backdrop-blur-sm shadow-sm"
          >
            <span className="mr-1">{categoryEmoji(product.category)}</span>
            {categoryLabel(product.category)}
          </Badge>
        </div>
        {/* Stock badge */}
        <div className="absolute right-2 top-2">
          <StockBadge state={stockState} />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-1.5 p-4">
        <h3 className="line-clamp-1 text-sm font-semibold text-foreground">
          {product.name}
        </h3>
        {product.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground min-h-[2rem]">
            {product.description}
          </p>
        )}
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-lg font-bold tabular-nums text-primary">
            {money(product.sellPrice)}
          </span>
          <span className="text-xs text-muted-foreground">
            {product.stock > 0 ? `${product.stock} in stock` : "Sold out"}
          </span>
        </div>
      </div>
    </Card>
  );
}

type StockState = "in-stock" | "low" | "out";

function deriveStockState(stock: number, threshold: number): StockState {
  if (stock <= 0) return "out";
  if (stock <= threshold) return "low";
  return "in-stock";
}

function StockBadge({ state }: { state: StockState }) {
  const config: Record<
    StockState,
    { label: string; className: string }
  > = {
    "in-stock": {
      label: "Available",
      className:
        "bg-emerald-500/90 text-white hover:bg-emerald-500/90",
    },
    low: {
      label: "Low stock",
      className: "bg-amber-500/90 text-white hover:bg-amber-500/90",
    },
    out: {
      label: "Sold out",
      className: "bg-zinc-500/90 text-white hover:bg-zinc-500/90",
    },
  };
  const c = config[state];
  return (
    <Badge className={cn("shadow-sm backdrop-blur-sm", c.className)}>
      {c.label}
    </Badge>
  );
}
