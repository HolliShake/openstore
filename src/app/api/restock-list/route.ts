/**
 * OpenStore — Grocery / restock list API.
 * GET /api/restock-list?weeks=4&coverDays=14   (signed-in staff)
 *
 * Answers: "What should I buy on my next grocery run, and in what order?"
 *
 * For every active product we compute:
 *   - unitsPerWeek  = units sold over the lookback window (default 4 weeks) ÷ weeks
 *   - daysLeft      = current stock ÷ (unitsPerWeek / 7)  — how long stock lasts
 *   - priority      = how urgently it needs buying:
 *       critical    out of stock (lost sales right now)
 *       high        at/below low-stock threshold, or < 7 days of cover
 *       medium      < 14 days of cover (buy on this trip)
 *       low         < 30 days of cover (optional — grab if budget allows)
 *   - suggestedQty  = units to buy so stock covers `coverDays` more days
 *                     (default 14). Zero-sale items are only listed when they
 *                     dip to/below their low-stock threshold.
 *
 * The list is sorted by priority tier first, then by sales speed (fast sellers
 * at the top of each tier) — so the fastest-moving items always float up.
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError, withStaff } from "@/lib/api";

export type RestockPriority = "critical" | "high" | "medium" | "low";

export const GET = withStaff(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const weeks = Math.max(1, Math.min(52, parseInt(url.searchParams.get("weeks") ?? "4", 10) || 4));
    const coverDays = Math.max(
      1,
      Math.min(90, parseInt(url.searchParams.get("coverDays") ?? "14", 10) || 14),
    );

    const end = new Date();
    const start = new Date(end.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);

    const products = await db.product.findMany({ where: { isActive: true } });
    const saleItems = await db.saleItem.findMany({
      where: { sale: { createdAt: { gte: start, lt: end } } },
      select: { productId: true, quantity: true },
    });

    // Units sold per product within the lookback window.
    const soldByProduct = new Map<string, number>();
    for (const item of saleItems) {
      soldByProduct.set(item.productId, (soldByProduct.get(item.productId) ?? 0) + item.quantity);
    }

    type Row = {
      productId: string;
      name: string;
      category: string;
      currentStock: number;
      lowStockThreshold: number;
      unitCost: number;
      sellPrice: number;
      unitsSold: number;
      unitsPerWeek: number;
      daysLeft: number | null; // null = no sales history (never runs "out" by velocity)
      priority: RestockPriority;
      suggestedQty: number;
      estCost: number;
      reason: string;
    };

    const rows: Row[] = [];

    for (const p of products) {
      const unitsSold = soldByProduct.get(p.id) ?? 0;
      const unitsPerWeek = unitsSold / weeks;
      const hasSales = unitsPerWeek > 0;
      const daysLeft = hasSales ? (p.stock / unitsPerWeek) * 7 : null;

      // ---- Priority tier ----
      let priority: RestockPriority | null = null;
      let reason = "";

      if (p.stock <= 0) {
        priority = "critical";
        reason = hasSales
          ? `Out of stock — sells ~${unitsPerWeek.toFixed(1)}/week`
          : "Out of stock";
      } else if (p.stock <= p.lowStockThreshold) {
        priority = "high";
        reason = `Low stock (at/below threshold of ${p.lowStockThreshold})`;
      } else if (hasSales && daysLeft! < 7) {
        priority = "high";
        reason = `Only ~${Math.floor(daysLeft!)} day${daysLeft! < 1.05 ? "" : "s"} of stock left`;
      } else if (hasSales && daysLeft! < coverDays) {
        priority = "medium";
        reason = `~${Math.floor(daysLeft!)} days of stock left — replenish this trip`;
      } else if (hasSales && daysLeft! < 30) {
        priority = "low";
        reason = `~${Math.floor(daysLeft!)} days of stock left — optional`;
      } else if (!hasSales && p.stock <= p.lowStockThreshold) {
        // covered above, kept for exhaustiveness
        priority = "low";
        reason = "Low stock (no recent sales)";
      }

      if (!priority) continue; // well stocked — not on the grocery list

      // ---- Suggested buy quantity ----
      // Target: enough stock to cover `coverDays` after this purchase.
      let suggestedQty: number;
      if (hasSales) {
        const targetStock = Math.ceil((unitsPerWeek / 7) * coverDays);
        suggestedQty = Math.max(targetStock - p.stock, 1);
      } else {
        // No sales history: just refill to the low-stock threshold.
        suggestedQty = Math.max(p.lowStockThreshold - p.stock, 1);
      }

      rows.push({
        productId: p.id,
        name: p.name,
        category: p.category,
        currentStock: p.stock,
        lowStockThreshold: p.lowStockThreshold,
        unitCost: p.unitCost,
        sellPrice: p.sellPrice,
        unitsSold,
        unitsPerWeek: Number(unitsPerWeek.toFixed(2)),
        daysLeft: daysLeft === null ? null : Math.round(daysLeft * 10) / 10,
        priority,
        suggestedQty,
        estCost: Math.round(suggestedQty * p.unitCost * 100) / 100,
        reason,
      });
    }

    // Sort: priority tier first (critical → low), then fastest sellers on top.
    const tierOrder: Record<RestockPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    rows.sort((a, b) => {
      const t = tierOrder[a.priority] - tierOrder[b.priority];
      if (t !== 0) return t;
      if (b.unitsPerWeek !== a.unitsPerWeek) return b.unitsPerWeek - a.unitsPerWeek;
      return a.name.localeCompare(b.name);
    });

    const summary = {
      itemCount: rows.length,
      totalUnits: rows.reduce((s, r) => s + r.suggestedQty, 0),
      totalEstCost: Math.round(rows.reduce((s, r) => s + r.estCost, 0) * 100) / 100,
      critical: rows.filter((r) => r.priority === "critical").length,
      high: rows.filter((r) => r.priority === "high").length,
      medium: rows.filter((r) => r.priority === "medium").length,
      low: rows.filter((r) => r.priority === "low").length,
    };

    return ok({
      generatedAt: end.toISOString(),
      weeks,
      coverDays,
      summary,
      items: rows,
    });
  } catch (e) {
    return serverError("Failed to build restock list", e);
  }
});
