"use client";

/**
 * OpenStore — Insights section.
 *
 * Answers two questions every store owner asks each restock cycle:
 *   1. What flies off the shelf?      → Best sellers (keep these stocked)
 *   2. What sits there gathering dust? → Slow movers (skip the next restock,
 *      or run a promo to clear). Shows the capital tied up in each so the
 *      cost of over-ordering is obvious.
 *
 * Time-range selector: 1 / 4 / 8 / 12 / 26 weeks.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  TrendingDown,
  Package,
  Coins,
  ShoppingCart,
  AlertCircle,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { useMoney } from "@/hooks/use-money";
import { categoryEmoji, categoryLabel } from "@/lib/constants";
import { SectionHeading } from "@/components/admin/sections/admin-expenses";

type AnalyticsRow = {
  productId: string;
  name: string;
  category: string;
  qtySold: number;
  revenue: number;
  saleCount: number;
  lastSoldAt: string | null;
  currentStock: number;
  unitCost: number;
  sellPrice: number;
  stockValue: number;
  lowStockThreshold: number;
  weeksSinceLastSale: number | null;
};

type AnalyticsData = {
  range: { start: string; end: string; weeks: number };
  summary: {
    totalRevenue: number;
    totalUnitsSold: number;
    distinctProductsSold: number;
    activeSkuCount: number;
    zeroSaleProducts: number;
    slowMoverTiedCapital: number;
  };
  bestSellers: AnalyticsRow[];
  slowMovers: AnalyticsRow[];
  rows: AnalyticsRow[];
};

const WEEK_OPTIONS = [
  { value: "1", label: "Last 1 week" },
  { value: "4", label: "Last 4 weeks" },
  { value: "8", label: "Last 8 weeks" },
  { value: "12", label: "Last 12 weeks" },
  { value: "26", label: "Last 26 weeks" },
];

export function AdminInsights() {
  const { money } = useMoney(); // configured currency
  const [weeks, setWeeks] = useState("4");
  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["analytics", weeks],
    queryFn: async () => {
      const r = await fetch(`/api/analytics?weeks=${weeks}`);
      if (!r.ok) throw new Error("Failed to load analytics");
      return r.json();
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <SectionHeading title="Insights" subtitle="Loading sales analytics…" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const { summary, bestSellers, slowMovers, range } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeading
          title="Sales Insights"
          subtitle={`Ranked by units sold · last ${range.weeks} week(s) · ${
            formatDate(range.start)
          } → ${formatDate(range.end)}`}
        />
        <Select value={weeks} onValueChange={setWeeks}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WEEK_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        <SummaryCard
          label="Revenue (period)"
          value={money(summary.totalRevenue)}
          icon={<Coins className="h-4 w-4" />}
          tone="pos"
        />
        <SummaryCard
          label="Units sold"
          value={String(summary.totalUnitsSold)}
          icon={<ShoppingCart className="h-4 w-4" />}
          tone="neutral"
        />
        <SummaryCard
          label="Capital in slow movers"
          value={money(summary.slowMoverTiedCapital)}
          sublabel={`${summary.zeroSaleProducts} zero-sale SKU(s)`}
          icon={<AlertCircle className="h-4 w-4" />}
          tone="neg"
        />
      </div>

      {/* Best sellers */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ThumbsUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <CardTitle className="text-base">Best sellers</CardTitle>
              <CardDescription>
                Keep these well-stocked — they drive most of your revenue.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {bestSellers.length === 0 || bestSellers[0].qtySold === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No sales in this period yet.
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead>Last sold</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bestSellers
                    .filter((r) => r.qtySold > 0)
                    .map((r, i) => (
                      <TableRow key={r.productId}>
                        <TableCell className="font-bold tabular-nums">{i + 1}</TableCell>
                        <TableCell>
                          <div className="font-medium">{categoryEmoji(r.category)} {r.name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {categoryLabel(r.category)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {r.qtySold}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {r.saleCount}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {money(r.revenue)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.lastSoldAt ? formatDate(r.lastSoldAt) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span
                            className={
                              r.currentStock <= r.lowStockThreshold
                                ? "text-amber-600 dark:text-amber-400 font-medium"
                                : ""
                            }
                          >
                            {r.currentStock}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Slow movers */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ThumbsDown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <div>
              <CardTitle className="text-base">Slow movers — consider skipping restock</CardTitle>
              <CardDescription>
                These barely sold in the selected period but still tie up cash on the shelf.
                Run a promo, mark down, or simply skip the next restock order.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {slowMovers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No stocked products in this range.
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="text-right">Last sold</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Tied-up capital</TableHead>
                    <TableHead>Recommendation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slowMovers.map((r) => (
                    <TableRow key={r.productId}>
                      <TableCell>
                        <div className="font-medium">{categoryEmoji(r.category)} {r.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {categoryLabel(r.category)} · cost {money(r.unitCost)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.qtySold > 0 ? (
                          <span className="text-muted-foreground">{r.qtySold}</span>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">0 sold</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {r.lastSoldAt
                          ? `${r.weeksSinceLastSale}w ago`
                          : <Badge variant="outline" className="text-[10px]">Never</Badge>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.currentStock}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium text-amber-600 dark:text-amber-400">
                        {money(r.stockValue)}
                      </TableCell>
                      <TableCell>
                        <RecommendationBadge row={r} weeks={range.weeks} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How to read this</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Best sellers</strong> — products with the highest
            units sold in the period. Always keep these in stock; consider ordering a bit more
            than the recent weekly average to avoid stock-outs.
          </p>
          <p>
            <strong className="text-foreground">Slow movers</strong> — products with the lowest
            units sold that still have stock on hand. <strong className="text-foreground">Tied-up
            capital</strong> is the cash you have sitting on the shelf for that product
            (unit cost × current stock). The longer it sits, the more it costs you in missed
            opportunities.
          </p>
          <p>
            <strong className="text-foreground">Recommendation</strong> badges:
            <span className="ml-2">
              <Badge variant="outline" className="text-[10px]">Skip restock</Badge> zero or near-zero sales AND stock is healthy — don&apos;t reorder.
            </span>
            <span className="ml-2">
              <Badge variant="secondary" className="text-[10px]">Mark down</Badge> zero sales for ≥ 4 weeks AND high tied-up capital — discount to clear.
            </span>
            <span className="ml-2">
              <Badge variant="outline" className="text-[10px]">Watch</Badge> slow but selling occasionally — keep an eye on it.
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function RecommendationBadge({ row, weeks }: { row: AnalyticsRow; weeks: number }) {
  // Decision tree (KISS):
  //   - 0 sold AND stock > threshold  → Skip restock
  //   - 0 sold AND weeksSinceLastSale >= 4 AND stockValue > 200 → Mark down
  //   - 1-2 sold over period          → Watch
  //   - else                          → (no badge)
  if (row.qtySold === 0 && row.currentStock > row.lowStockThreshold) {
    if ((row.weeksSinceLastSale ?? 99) >= 4 && row.stockValue >= 200) {
      return <Badge className="bg-amber-500 text-white hover:bg-amber-500 text-[10px]">Mark down</Badge>;
    }
    return <Badge variant="outline" className="text-[10px]">Skip restock</Badge>;
  }
  if (row.qtySold > 0 && row.qtySold <= Math.max(2, Math.floor(weeks / 2))) {
    return <Badge variant="secondary" className="text-[10px]">Watch</Badge>;
  }
  return <span className="text-[10px] text-muted-foreground">—</span>;
}

function SummaryCard({
  label,
  value,
  sublabel,
  icon,
  tone,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: React.ReactNode;
  tone: "pos" | "neg" | "neutral";
}) {
  const toneClass: Record<string, string> = {
    pos: "text-emerald-600 dark:text-emerald-400",
    neg: "text-amber-600 dark:text-amber-400",
    neutral: "text-foreground",
  };
  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
            {label}
          </span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <div className={`mt-1.5 text-lg font-bold tabular-nums sm:mt-2 sm:text-2xl ${toneClass[tone]}`}>
          {value}
        </div>
        {sublabel && (
          <div className="mt-0.5 text-[10px] text-muted-foreground sm:mt-1 sm:text-xs">
            {sublabel}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
