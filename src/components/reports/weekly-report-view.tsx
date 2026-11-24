"use client";

/**
 * OpenStore — Printable weekly audit report (app view, not an API artifact).
 * Route: /report?week=N
 *
 * Fetches JSON from /api/reports/weekly (admin-gated) and renders a clean,
 * print-optimised page. Uses a fixed light palette so it prints correctly
 * regardless of the active dark/light theme.
 */
import { useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Printer, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatDateTime } from "@/lib/format";
import { lossReasonLabel } from "@/lib/constants";
import { useStoreConfig } from "@/components/providers/config-provider";
import { useMoney } from "@/hooks/use-money";

type ReportData = {
  week: { start: string; end: string; offset: number };
  summary: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    lossValue: number;
    lossQty: number;
    expensesTotal: number;
    netProfit: number;
    saleCount: number;
    lossCount: number;
    expenseCount: number;
    stockValue: number;
    activeSkuCount: number;
  };
  sales: {
    id: string;
    createdAt: string;
    payment: string;
    customerName: string | null;
    note: string | null;
    createdBy: string | null;
    total: number;
    items: { productName: string; quantity: number; unitPrice: number; subtotal: number }[];
  }[];
  losses: {
    id: string;
    createdAt: string;
    productName: string;
    quantity: number;
    reason: string;
    note: string | null;
    createdBy: string | null;
    costValue: number;
  }[];
  expenses: {
    id: string;
    createdAt: string;
    description: string;
    category: string;
    createdBy: string | null;
    amount: number;
  }[];
};

export function WeeklyReportView() {
  const { config } = useStoreConfig();
  const { money } = useMoney();
  const params = useSearchParams();
  const week = params.get("week") ?? "0";

  const { data, isLoading, isError, error } = useQuery<ReportData>({
    queryKey: ["report", "weekly", week],
    queryFn: async () => {
      const r = await fetch(`/api/reports/weekly?week=${week}`);
      if (r.status === 401) throw new Error("UNAUTHORIZED");
      if (!r.ok) throw new Error("Failed to load report");
      return r.json();
    },
    retry: false,
  });

  useEffect(() => {
    document.title = `${config.storeName} — Weekly Report`;
  }, [config.storeName]);

  if (isError && error.message === "UNAUTHORIZED") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-4 text-zinc-900">
        <Lock className="h-8 w-8 text-zinc-400" />
        <h1 className="text-lg font-semibold">Sign in required</h1>
        <p className="text-sm text-zinc-500">
          The weekly report contains your store&apos;s financial data.
        </p>
        <Button asChild>
          <Link href={`/login?callbackUrl=${encodeURIComponent(`/report?week=${week}`)}`}>
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
            href="/admin/reports"
            className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back to admin
          </Link>
          <Button onClick={() => window.print()} size="sm">
            <Printer className="mr-1 h-4 w-4" /> Print / Save PDF
          </Button>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-6 py-8 print:px-0 print:py-0">
        {isLoading || !data ? (
          <ReportSkeleton />
        ) : (
          <>
            {/* Header */}
            <header className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight">
                {config.storeName} — Weekly Audit Report
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                {formatDate(data.week.start)} –{" "}
                {formatDate(new Date(new Date(data.week.end).getTime() - 1))}
              </p>
            </header>

            {/* KPI summary */}
            <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4">
              <Kpi label="Revenue" value={money(data.summary.revenue)} tone="pos" />
              <Kpi label="Cost of Goods" value={money(data.summary.cogs)} />
              <Kpi
                label="Gross Profit"
                value={money(data.summary.grossProfit)}
                tone={data.summary.grossProfit >= 0 ? "pos" : "neg"}
              />
              <Kpi label="Losses" value={money(data.summary.lossValue)} tone="neg" />
              <Kpi label="Expenses" value={money(data.summary.expensesTotal)} />
              <Kpi
                label="Net Profit"
                value={money(data.summary.netProfit)}
                tone={data.summary.netProfit >= 0 ? "pos" : "neg"}
                bold
              />
              <Kpi label="Sales Count" value={String(data.summary.saleCount)} />
              <Kpi label="Stock Value" value={money(data.summary.stockValue)} />
            </section>

            {/* Sales */}
            <ReportSection title={`Sales (${data.summary.saleCount})`}>
              {data.sales.length === 0 ? (
                <Empty>No sales this week.</Empty>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b-2 border-zinc-900">
                      <th className="py-1.5 pr-2 font-semibold">#</th>
                      <th className="py-1.5 pr-2 font-semibold">When</th>
                      <th className="py-1.5 pr-2 font-semibold">Items</th>
                      <th className="py-1.5 pr-2 font-semibold">Customer</th>
                      <th className="py-1.5 pr-2 font-semibold">Recorded by</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">Total</th>
                      <th className="py-1.5 font-semibold">Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sales.map((s, i) => (
                      <tr key={s.id} className="border-b border-zinc-100 align-top">
                        <td className="py-1.5 pr-2">{i + 1}</td>
                        <td className="whitespace-nowrap py-1.5 pr-2">
                          {new Date(s.createdAt).toLocaleString("en-PH", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                          {s.note && (
                            <span
                              className="ml-1 text-[9px] uppercase text-zinc-400"
                              title={s.note}
                            >
                              paper*
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 pr-2">
                          {s.items.map((it) => `${it.quantity}× ${it.productName}`).join(", ")}
                        </td>
                        <td className="py-1.5 pr-2 text-zinc-600">
                          {s.customerName ?? <span className="italic text-zinc-400">Walk-in</span>}
                        </td>
                        <td className="py-1.5 pr-2 text-zinc-600">
                          {s.createdBy ?? <span className="italic text-zinc-400">unknown</span>}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-medium tabular-nums">
                          {money(s.total)}
                        </td>
                        <td className="py-1.5 capitalize">{s.payment}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-zinc-300">
                      <td colSpan={5} className="py-1.5 font-semibold">
                        Total Revenue
                      </td>
                      <td className="py-1.5 text-right font-bold tabular-nums">
                        {money(data.summary.revenue)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}
              {data.sales.some((s) => s.note) && (
                <p className="mt-1 text-[10px] text-zinc-400">
                  * paper = manually recorded from a paper list (e.g. during a power or
                  internet outage); hover for the note.
                </p>
              )}
            </ReportSection>

            {/* Losses */}
            <ReportSection
              title={`Losses (${data.summary.lossCount}) — ${data.summary.lossQty} unit(s)`}
            >
              {data.losses.length === 0 ? (
                <Empty>No losses recorded.</Empty>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b-2 border-zinc-900">
                      <th className="py-1.5 pr-2 font-semibold">#</th>
                      <th className="py-1.5 pr-2 font-semibold">When</th>
                      <th className="py-1.5 pr-2 font-semibold">Product</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">Qty</th>
                      <th className="py-1.5 pr-2 font-semibold">Reason</th>
                      <th className="py-1.5 pr-2 font-semibold">Recorded by</th>
                      <th className="py-1.5 text-right font-semibold">Cost Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.losses.map((l, i) => (
                      <tr key={l.id} className="border-b border-zinc-100">
                        <td className="py-1.5 pr-2">{i + 1}</td>
                        <td className="whitespace-nowrap py-1.5 pr-2">{formatDate(l.createdAt)}</td>
                        <td className="py-1.5 pr-2">
                          {l.productName}
                          {l.note && (
                            <span className="block text-[10px] text-zinc-400">{l.note}</span>
                          )}
                        </td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">{l.quantity}</td>
                        <td className="py-1.5 pr-2">{lossReasonLabel(l.reason)}</td>
                        <td className="py-1.5 pr-2 text-zinc-600">
                          {l.createdBy ?? <span className="italic text-zinc-400">unknown</span>}
                        </td>
                        <td className="py-1.5 text-right font-medium tabular-nums">
                          {money(l.costValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-zinc-300">
                      <td colSpan={6} className="py-1.5 font-semibold">
                        Total Loss Value
                      </td>
                      <td className="py-1.5 text-right font-bold tabular-nums text-red-700">
                        {money(data.summary.lossValue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </ReportSection>

            {/* Expenses */}
            <ReportSection title={`Expenses (${data.summary.expenseCount})`}>
              {data.expenses.length === 0 ? (
                <Empty>No expenses recorded.</Empty>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b-2 border-zinc-900">
                      <th className="py-1.5 pr-2 font-semibold">#</th>
                      <th className="py-1.5 pr-2 font-semibold">When</th>
                      <th className="py-1.5 pr-2 font-semibold">Description</th>
                      <th className="py-1.5 pr-2 font-semibold">Category</th>
                      <th className="py-1.5 pr-2 font-semibold">Recorded by</th>
                      <th className="py-1.5 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.expenses.map((e, i) => (
                      <tr key={e.id} className="border-b border-zinc-100">
                        <td className="py-1.5 pr-2">{i + 1}</td>
                        <td className="whitespace-nowrap py-1.5 pr-2">
                          {formatDate(e.createdAt)}
                        </td>
                        <td className="py-1.5 pr-2">{e.description}</td>
                        <td className="py-1.5 pr-2 capitalize">{e.category}</td>
                        <td className="py-1.5 pr-2 text-zinc-600">
                          {e.createdBy ?? <span className="italic text-zinc-400">unknown</span>}
                        </td>
                        <td className="py-1.5 text-right font-medium tabular-nums">
                          {money(e.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-zinc-300">
                      <td colSpan={5} className="py-1.5 font-semibold">
                        Total Expenses
                      </td>
                      <td className="py-1.5 text-right font-bold tabular-nums">
                        {money(data.summary.expensesTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </ReportSection>

            <footer className="mt-8 border-t border-zinc-200 pt-3 text-[10px] text-zinc-400">
              Generated {formatDateTime(new Date())} · {config.storeName} inventory system ·{" "}
              {data.summary.activeSkuCount} active SKUs · Stock value snapshot:{" "}
              {money(data.summary.stockValue)}
            </footer>
          </>
        )}
      </main>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
  bold,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
  bold?: boolean;
}) {
  const color =
    tone === "pos" ? "text-emerald-700" : tone === "neg" ? "text-red-700" : "text-zinc-900";
  return (
    <div className="rounded-lg border border-zinc-200 p-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</div>
      <div
        className={`mt-1 tabular-nums ${bold ? "text-xl font-bold" : "text-lg font-semibold"} ${color}`}
      >
        {value}
      </div>
    </div>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 border-b-2 border-zinc-900 pb-1 text-sm font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-xs text-zinc-400">{children}</p>;
}

function ReportSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading report…
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}
