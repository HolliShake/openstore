/**
 * OpenStore — Weekly report DATA endpoint (JSON only).
 * GET /api/reports/weekly?week=current|prev|0..N   (admin only)
 *
 * Returns every figure the printable weekly report view needs. Rendering is
 * done by the view layer at /report — API routes carry data, not markup.
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError, withAdmin } from "@/lib/api";
import { weekRangeOffset } from "@/lib/format";

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const weekParam = url.searchParams.get("week") ?? "current";
    const offset =
      weekParam === "current" ? 0 : weekParam === "prev" ? 1 : Number(weekParam) || 0;
    const [weekStart, weekEnd] = weekRangeOffset(offset);

    const [sales, losses, expenses, products] = await Promise.all([
      db.sale.findMany({
        where: { createdAt: { gte: weekStart, lt: weekEnd } },
        include: { items: { include: { product: { select: { name: true } } } } },
        orderBy: { createdAt: "asc" },
      }),
      db.loss.findMany({
        where: { createdAt: { gte: weekStart, lt: weekEnd } },
        include: { product: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      }),
      db.expense.findMany({
        where: { createdAt: { gte: weekStart, lt: weekEnd } },
        orderBy: { createdAt: "asc" },
      }),
      db.product.findMany({ where: { isActive: true } }),
    ]);

    const revenue = sales.reduce((s, x) => s + x.total, 0);
    // COGS from per-item cost snapshots (weighted-average cost at time of sale).
    const cogs = sales
      .flatMap((s) => s.items)
      .reduce((sum, it) => sum + it.unitCost * it.quantity, 0);
    const lossValue = losses.reduce((s, l) => s + l.unitCost * l.quantity, 0);
    const expensesTotal = expenses.reduce((s, e) => s + e.amount, 0);
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - lossValue - expensesTotal;
    const stockValue = products.reduce((s, p) => s + p.unitCost * p.stock, 0);

    return ok({
      week: { start: weekStart, end: weekEnd, offset },
      summary: {
        revenue,
        cogs,
        grossProfit,
        lossValue,
        lossQty: losses.reduce((s, l) => s + l.quantity, 0),
        expensesTotal,
        netProfit,
        saleCount: sales.length,
        lossCount: losses.length,
        expenseCount: expenses.length,
        stockValue,
        activeSkuCount: products.length,
      },
      sales: sales.map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        payment: s.payment,
        customerName: s.customerName,
        note: s.note,
        // AUDIT: who recorded this sale (admin or cashier).
        createdBy: s.createdBy,
        total: s.total,
        items: s.items.map((it) => ({
          productName: it.product.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          subtotal: it.subtotal,
        })),
      })),
      losses: losses.map((l) => ({
        id: l.id,
        createdAt: l.createdAt,
        productName: l.product.name,
        quantity: l.quantity,
        reason: l.reason,
        note: l.note,
        createdBy: l.createdBy,
        costValue: l.unitCost * l.quantity,
      })),
      expenses: expenses.map((e) => ({
        id: e.id,
        createdAt: e.createdAt,
        description: e.description,
        category: e.category,
        createdBy: e.createdBy,
        amount: e.amount,
      })),
    });
  } catch (e) {
    return serverError("Failed to build weekly report data", e);
  }
});
