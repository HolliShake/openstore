/**
 * OpenStore — Dashboard statistics endpoint.
 * GET /api/dashboard?week=current|prev|0..N
 *
 * Returns a single payload with everything the dashboard needs:
 *   - weekly: revenue, COGS, grossProfit, losses, expenses, netProfit
 *   - monthly: month-to-date revenue/COGS/gross/net + sales count
 *   - annual: year-to-date revenue/COGS/gross/net + sales count
 *   - monthlyTrend: last 12 calendar months of revenue/cogs/net
 *   - totals: stockValue (cost), stockUnits, productCount
 *   - lowStock: products at/below threshold
 *   - recentSales: last 8 sales (with items)
 *   - byCategory: revenue & cogs grouped by product.category
 *   - weeklyTrend: last 6 weeks of revenue/loss/net
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError, withAdmin } from "@/lib/api";
import { weekRangeOffset } from "@/lib/format";

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const weekParam = url.searchParams.get("week") ?? "current";
    const offset = weekParam === "current" ? 0 : weekParam === "prev" ? 1 : Number(weekParam) || 0;
    const [weekStart, weekEnd] = weekRangeOffset(offset);

    // ----- This week's sales + items -----
    const sales = await db.sale.findMany({
      where: { createdAt: { gte: weekStart, lt: weekEnd } },
      include: { items: { include: { product: true } } },
    });
    const losses = await db.loss.findMany({
      where: { createdAt: { gte: weekStart, lt: weekEnd } },
      include: { product: true },
    });
    const expenses = await db.expense.findMany({
      where: { createdAt: { gte: weekStart, lt: weekEnd } },
    });

    // Revenue = sum of sale.total
    const revenue = sales.reduce((s, x) => s + x.total, 0);
    // COGS = sum over saleItems of (unitCost × quantity), where unitCost is the
    // product's weighted-average cost snapshotted at time of sale. Exact even
    // when the same product was restocked at different prices.
    let cogs = 0;
    const byCategory: Record<
      string,
      { revenue: number; cogs: number; qty: number }
    > = {};
    for (const sale of sales) {
      for (const item of sale.items) {
        const cost = item.unitCost * item.quantity;
        cogs += cost;
        const cat = item.product.category;
        if (!byCategory[cat]) byCategory[cat] = { revenue: 0, cogs: 0, qty: 0 };
        byCategory[cat].revenue += item.subtotal;
        byCategory[cat].cogs += cost;
        byCategory[cat].qty += item.quantity;
      }
    }
    const grossProfit = revenue - cogs;

    // Losses valued at snapshotted unitCost * qty.
    const lossValue = losses.reduce((s, l) => s + l.unitCost * l.quantity, 0);
    const lossQty = losses.reduce((s, l) => s + l.quantity, 0);

    const expensesTotal = expenses.reduce((s, e) => s + e.amount, 0);
    const netProfit = grossProfit - lossValue - expensesTotal;

    // ----- Current stock value (whole store) -----
    const allProducts = await db.product.findMany({ where: { isActive: true } });
    const stockValue = allProducts.reduce((s, p) => s + p.unitCost * p.stock, 0);
    const stockUnits = allProducts.reduce((s, p) => s + p.stock, 0);
    const lowStock = allProducts
      .filter((p) => p.stock <= p.lowStockThreshold)
      .sort((a, b) => a.stock - b.stock);

    // ----- Recent sales (top 8) -----
    const recentSales = await db.sale.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { items: true },
    });

    // ----- 6-week trend -----
    const weeklyTrend: {
      label: string;
      revenue: number;
      cogs: number;
      losses: number;
      expenses: number;
      net: number;
    }[] = [];
    for (let w = 5; w >= 0; w--) {
      const [s, e] = weekRangeOffset(w);
      const [wkSales, wkLosses, wkExpenses] = await Promise.all([
        db.sale.findMany({ where: { createdAt: { gte: s, lt: e } }, include: { items: { include: { product: true } } } }),
        db.loss.findMany({ where: { createdAt: { gte: s, lt: e } } }),
        db.expense.findMany({ where: { createdAt: { gte: s, lt: e } } }),
      ]);
      const rev = wkSales.reduce((sum, x) => sum + x.total, 0);
      const c = wkSales.flatMap((x) => x.items).reduce(
        (sum, it) => sum + it.unitCost * it.quantity,
        0,
      );
      const lossVal = wkLosses.reduce((sum, l) => sum + l.unitCost * l.quantity, 0);
      const exp = wkExpenses.reduce((sum, x) => sum + x.amount, 0);
      weeklyTrend.push({
        label: `W-${w}`,
        revenue: rev,
        cogs: c,
        losses: lossVal,
        expenses: exp,
        net: rev - c - lossVal - exp,
      });
    }

    // ----- Top sellers / slow movers for this week (quick glance) -----
    // Aggregate sale items in this week by product.
    const sellerMap = new Map<
      string,
      { productId: string; name: string; category: string; qtySold: number; revenue: number }
    >();
    for (const sale of sales) {
      for (const item of sale.items) {
        const id = item.productId;
        const existing = sellerMap.get(id);
        if (existing) {
          existing.qtySold += item.quantity;
          existing.revenue += item.subtotal;
        } else {
          sellerMap.set(id, {
            productId: id,
            name: item.product.name,
            category: item.product.category,
            qtySold: item.quantity,
            revenue: item.subtotal,
          });
        }
      }
    }
    const topSellers = Array.from(sellerMap.values())
      .sort((a, b) => b.qtySold - a.qtySold)
      .slice(0, 5);

    // Slow movers for the week: products with 0 sales in this week but with stock on hand,
    // sorted by tied-up capital descending (so the most cash-locked ones show first).
    const soldIds = new Set(sellerMap.keys());
    const slowMoversThisWeek = allProducts
      .filter((p) => !soldIds.has(p.id) && p.stock > 0)
      .map((p) => ({
        productId: p.id,
        name: p.name,
        category: p.category,
        currentStock: p.stock,
        unitCost: p.unitCost,
        stockValue: p.unitCost * p.stock,
      }))
      .sort((a, b) => b.stockValue - a.stockValue)
      .slice(0, 5);

    // ----- Monthly & annual income (calendar month / year to date) -----
    // One query per table over a window that covers the last 12 calendar
    // months AND Jan 1 of the current year (whichever is earlier), then
    // aggregate in JS by month key.
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    // First day of the month 11 months back = start of the 12-month trend.
    const trendStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const windowStart = trendStart < yearStart ? trendStart : yearStart;

    const [salesLong, lossesLong, expensesLong] = await Promise.all([
      db.sale.findMany({
        where: { createdAt: { gte: windowStart, lt: now } },
        include: { items: true },
      }),
      db.loss.findMany({ where: { createdAt: { gte: windowStart, lt: now } } }),
      db.expense.findMany({ where: { createdAt: { gte: windowStart, lt: now } } }),
    ]);

    // Month key "YYYY-M" -> aggregates.
    const monthMap = new Map<
      string,
      { revenue: number; cogs: number; losses: number; expenses: number; saleCount: number }
    >();
    const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthMap.set(monthKey(d), { revenue: 0, cogs: 0, losses: 0, expenses: 0, saleCount: 0 });
    }
    const inRange = (d: Date) =>
      d >= windowStart && d < now &&
      monthMap.has(monthKey(d)); // trend window only (excludes months before the 12)

    for (const s of salesLong) {
      if (!inRange(s.createdAt)) continue;
      const m = monthMap.get(monthKey(s.createdAt))!;
      m.revenue += s.total;
      m.saleCount += 1;
      m.cogs += s.items.reduce((sum, it) => sum + it.unitCost * it.quantity, 0);
    }
    for (const l of lossesLong) {
      if (!inRange(l.createdAt)) continue;
      monthMap.get(monthKey(l.createdAt))!.losses += l.unitCost * l.quantity;
    }
    for (const e of expensesLong) {
      if (!inRange(e.createdAt)) continue;
      monthMap.get(monthKey(e.createdAt))!.expenses += e.amount;
    }

    const monthShort = (offset: number) =>
      new Date(now.getFullYear(), now.getMonth() - offset, 1).toLocaleDateString("en-PH", {
        month: "short",
      });

    // monthMap is in insertion order: oldest (11 months ago) -> current month.
    const monthlyTrend = Array.from(monthMap.values()).map((m, index) => ({
      label: monthShort(11 - index),
      revenue: m.revenue,
      cogs: m.cogs,
      losses: m.losses,
      expenses: m.expenses,
      net: m.revenue - m.cogs - m.losses - m.expenses,
    }));

    // Month-to-date / year-to-date rollups (straight from the fetched rows so
    // months outside the 12-trend window still count toward YTD).
    const sumRange = <T extends { createdAt: Date }>(
      rows: T[],
      from: Date,
      fn: (r: T) => number,
    ) => rows.filter((r) => r.createdAt >= from && r.createdAt < now).reduce((s, r) => s + fn(r), 0);

    const rollup = (from: Date) => {
      const rev = sumRange(salesLong, from, (s) => s.total);
      const cogsSum = sumRange(salesLong, from, (s) =>
        s.items.reduce((sum, it) => sum + it.unitCost * it.quantity, 0),
      );
      const lossSum = sumRange(lossesLong, from, (l) => l.unitCost * l.quantity);
      const expSum = sumRange(expensesLong, from, (e) => e.amount);
      return {
        revenue: rev,
        cogs: cogsSum,
        grossProfit: rev - cogsSum,
        losses: lossSum,
        expenses: expSum,
        netProfit: rev - cogsSum - lossSum - expSum,
        saleCount: salesLong.filter((s) => s.createdAt >= from && s.createdAt < now).length,
      };
    };

    const monthly = rollup(monthStart);
    const annual = rollup(yearStart);

    return ok({
      week: { start: weekStart, end: weekEnd, offset },
      monthly,
      annual,
      monthlyTrend,
      weekly: {
        revenue,
        cogs,
        grossProfit,
        losses: lossValue,
        lossQty,
        expenses: expensesTotal,
        netProfit,
        saleCount: sales.length,
      },
      totals: {
        stockValue,
        stockUnits,
        productCount: allProducts.length,
        lowStockCount: lowStock.length,
      },
      lowStock,
      recentSales,
      byCategory,
      weeklyTrend,
      topSellers,
      slowMovers: slowMoversThisWeek,
    });
  } catch (e) {
    return serverError("Failed to compute dashboard", e);
  }
});
