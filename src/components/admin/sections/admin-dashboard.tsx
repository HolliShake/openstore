"use client";

/**
 * OpenStore — Dashboard.
 * Weekly KPIs (revenue, COGS, gross profit, losses, expenses, net profit),
 * 6-week trend chart, category breakdown, low-stock alerts, recent sales.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  Banknote,
  Coins,
  Scale,
  Wallet,
  ArrowRight,
  ShoppingCart,
  CalendarRange,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
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
import { queryKeys } from "@/lib/query-client";
import { formatDateTime, weekLabel } from "@/lib/format";
import { useMoney } from "@/hooks/use-money";
import { categoryLabel, categoryEmoji } from "@/lib/constants";
import { SectionHeading } from "@/components/admin/sections/admin-expenses";

type PeriodStats = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  losses: number;
  expenses: number;
  netProfit: number;
  saleCount: number;
};

type DashboardData = {
  week: { start: string; end: string; offset: number };
  monthly: PeriodStats;
  annual: PeriodStats;
  monthlyTrend: {
    label: string;
    revenue: number;
    cogs: number;
    losses: number;
    expenses: number;
    net: number;
  }[];
  weekly: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    losses: number;
    lossQty: number;
    expenses: number;
    netProfit: number;
    saleCount: number;
  };
  totals: {
    stockValue: number;
    stockUnits: number;
    productCount: number;
    lowStockCount: number;
  };
  lowStock: {
    id: string;
    name: string;
    category: string;
    stock: number;
    lowStockThreshold: number;
    sellPrice: number;
  }[];
  recentSales: {
    id: string;
    total: number;
    payment: string;
    customerName: string | null;
    createdAt: string;
    items: { id: string }[];
  }[];
  byCategory: Record<string, { revenue: number; cogs: number; qty: number }>;
  weeklyTrend: {
    label: string;
    revenue: number;
    cogs: number;
    losses: number;
    expenses: number;
    net: number;
  }[];
  topSellers: {
    productId: string;
    name: string;
    category: string;
    qtySold: number;
    revenue: number;
  }[];
  slowMovers: {
    productId: string;
    name: string;
    category: string;
    currentStock: number;
    unitCost: number;
    stockValue: number;
  }[];
};

export function AdminDashboard() {
  const { money, moneyCompact } = useMoney(); // configured currency
  const [week, setWeek] = useState("0");
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: queryKeys.dashboard(week),
    queryFn: async () => {
      const r = await fetch(`/api/dashboard?week=${week}`);
      if (!r.ok) throw new Error("Failed to load dashboard");
      return r.json();
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <SectionHeading title="Dashboard" subtitle="Loading this week's audit…" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const { weekly, monthly, annual, monthlyTrend, totals, lowStock, recentSales, byCategory, weeklyTrend, topSellers, slowMovers } = data;
  const weekStart = new Date(data.week.start);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeading
          title="Dashboard"
          subtitle={`${weekLabel(weekStart)} · ${weekly.saleCount} sale(s) this week`}
        />
        <Select value={week} onValueChange={setWeek}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">This week</SelectItem>
            <SelectItem value="1">Last week</SelectItem>
            <SelectItem value="2">2 weeks ago</SelectItem>
            <SelectItem value="3">3 weeks ago</SelectItem>
            <SelectItem value="4">4 weeks ago</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI grid — 2 columns on mobile so 8 KPIs fit in 4 rows instead of 8 */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <KpiCard
          label="Revenue"
          value={money(weekly.revenue)}
          icon={<Banknote className="h-4 w-4" />}
          tone="pos"
        />
        <KpiCard
          label="Cost of Goods"
          value={money(weekly.cogs)}
          icon={<Coins className="h-4 w-4" />}
          tone="neutral"
        />
        <KpiCard
          label="Gross Profit"
          value={money(weekly.grossProfit)}
          icon={<Scale className="h-4 w-4" />}
          tone={weekly.grossProfit >= 0 ? "pos" : "neg"}
        />
        <KpiCard
          label="Net Profit"
          value={money(weekly.netProfit)}
          icon={weekly.netProfit >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          tone={weekly.netProfit >= 0 ? "pos" : "neg"}
          highlight
        />
        <KpiCard
          label="Losses"
          value={money(weekly.losses)}
          sublabel={`${weekly.lossQty} unit(s)`}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="neg"
        />
        <KpiCard
          label="Expenses"
          value={money(weekly.expenses)}
          icon={<Wallet className="h-4 w-4" />}
          tone="neutral"
        />
        <KpiCard
          label="Stock Value"
          value={money(totals.stockValue)}
          sublabel={`${totals.stockUnits} units`}
          icon={<Package className="h-4 w-4" />}
          tone="neutral"
        />
        <KpiCard
          label="Low-stock alerts"
          value={String(totals.lowStockCount)}
          sublabel={`${totals.productCount} active SKUs`}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={totals.lowStockCount > 0 ? "warning" : "neutral"}
        />
      </div>

      {/* Monthly & annual income overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="h-4 w-4 text-primary" />
            Income — this month &amp; this year
          </CardTitle>
          <CardDescription>
            Calendar month-to-date and year-to-date sales and profit. Same audit
            logic as the weekly numbers, rolled up over longer periods.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <PeriodCard title="This month (to date)" period={monthly} />
            <PeriodCard title={`This year (${new Date().getFullYear()})`} period={annual} />
          </div>

          {/* 12-month income trend */}
          <div>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Last 12 months — revenue vs net income
            </h4>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis
                    tickFormatter={(v) => moneyCompact(Number(v))}
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    width={62}
                  />
                  <Tooltip
                    formatter={(v: number) => money(v)}
                    contentStyle={{
                      background: "var(--popover)",
                      color: "var(--popover-foreground)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="revenue" name="Revenue" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="net" name="Net income" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trend chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">6-week trend</CardTitle>
          <CardDescription>Revenue, cost, losses, expenses, and net profit per week.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyTrend} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  tickFormatter={(v) => moneyCompact(Number(v))}
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  width={70}
                />
                <Tooltip
                  formatter={(v: number) => money(v)}
                  contentStyle={{
                    background: "var(--popover)",
                    color: "var(--popover-foreground)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" name="Revenue" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cogs" name="COGS" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="losses" name="Losses" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="net" name="Net" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Top sellers + Slow movers (quick glance — full breakdown in Insights tab) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Top sellers this week
              </CardTitle>
              <CardDescription>What&apos;s flying off the shelf — keep stocked.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin?tab=insights">
                Insights <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {topSellers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No sales yet this week.
              </p>
            ) : (
              <ol className="space-y-2">
                {topSellers.map((s, i) => (
                  <li key={s.productId} className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        {i + 1}
                      </span>
                      <span className="truncate font-medium">{s.name}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 tabular-nums">
                      <Badge variant="secondary" className="text-[10px]">{s.qtySold} sold</Badge>
                      <span className="text-muted-foreground">{money(s.revenue)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                Slow movers this week
              </CardTitle>
              <CardDescription>Zero sales but cash tied up — skip restock.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin?tab=insights">
                Insights <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {slowMovers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Every stocked product sold this week — great!
              </p>
            ) : (
              <ol className="space-y-2">
                {slowMovers.map((s) => (
                  <li key={s.productId} className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                        !
                      </span>
                      <span className="truncate font-medium">{s.name}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 tabular-nums">
                      <Badge variant="outline" className="text-[10px]">{s.currentStock} in stock</Badge>
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        {money(s.stockValue)}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Low stock + category breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Low-stock alerts</CardTitle>
              <CardDescription>Items at or below their reorder threshold.</CardDescription>
            </div>
            <div className="flex items-center gap-1">
              <Button asChild variant="ghost" size="sm">
                <Link href="/restock-list" target="_blank" rel="noopener noreferrer">
                  <ShoppingCart className="mr-1 h-3 w-3" /> Grocery list
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin?tab=inventory">
                  Manage <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                All products are above their reorder threshold.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {lowStock.slice(0, 8).map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2">
                      <span>{categoryEmoji(p.category)}</span>
                      <div>
                        <div className="text-sm font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {categoryLabel(p.category)} · {money(p.sellPrice)}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant={p.stock <= 0 ? "destructive" : "secondary"}
                      className={p.stock > 0 && p.stock <= p.lowStockThreshold ? "bg-amber-500 text-white hover:bg-amber-500" : ""}
                    >
                      {p.stock} left
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue by category</CardTitle>
            <CardDescription>Where this week&apos;s sales came from.</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(byCategory).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No sales this week yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {Object.entries(byCategory)
                  .sort((a, b) => b[1].revenue - a[1].revenue)
                  .map(([cat, v]) => (
                    <li key={cat} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>
                          {categoryEmoji(cat)} {categoryLabel(cat)}{" "}
                          <span className="text-muted-foreground">· {v.qty} sold</span>
                        </span>
                        <span className="font-medium tabular-nums">{money(v.revenue)}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div
                          className="h-1.5 rounded-full bg-primary"
                          style={{
                            width: `${Math.min(
                              100,
                              (v.revenue /
                                Math.max(...Object.values(byCategory).map((x) => x.revenue))) *
                                100,
                            )}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent sales */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Recent sales</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin?tab=pos">
              New sale <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentSales.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No sales recorded yet. Use the POS tab to record your first sale.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recentSales.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="text-sm font-medium">{money(s.total)}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.customerName ?? "Walk-in"} · {formatDateTime(s.createdAt)} · {s.items.length} item(s)
                    </div>
                  </div>
                  <Badge variant="outline" className="capitalize">{s.payment}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Month/year income summary: revenue -> gross -> net waterfall in a compact card. */
function PeriodCard({ title, period }: { title: string; period: PeriodStats }) {
  const { money } = useMoney(); // configured currency
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="text-2xl font-bold tabular-nums">
        {money(period.revenue)}
      </div>
      <div className="text-xs text-muted-foreground">
        sales · {period.saleCount} transaction{period.saleCount === 1 ? "" : "s"}
      </div>
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Gross profit</dt>
          <dd className="font-medium tabular-nums">{money(period.grossProfit)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Losses + expenses</dt>
          <dd className="tabular-nums text-destructive">
            −{money(period.losses + period.expenses)}
          </dd>
        </div>
        <div className="flex items-center justify-between border-t pt-1.5">
          <dt className="font-medium">Net income</dt>
          <dd
            className={`text-base font-bold tabular-nums ${
              period.netProfit >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-destructive"
            }`}
          >
            {money(period.netProfit)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sublabel,
  icon,
  tone,
  highlight,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: React.ReactNode;
  tone: "pos" | "neg" | "neutral" | "warning";
  highlight?: boolean;
}) {
  const toneClass: Record<string, string> = {
    pos: "text-emerald-600 dark:text-emerald-400",
    neg: "text-destructive",
    warning: "text-amber-600 dark:text-amber-400",
    neutral: "text-foreground",
  };
  return (
    <Card className={highlight ? "border-primary/40 shadow-sm" : ""}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
            {label}
          </span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        {/* Value: smaller on mobile so "₱22,306.00" fits a 2-col grid; larger on sm+ */}
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
