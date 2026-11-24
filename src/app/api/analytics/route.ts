/**
 * OpenStore — Sales analytics endpoint.
 * GET /api/analytics?weeks=4
 *
 * Aggregates SaleItem data over the last N weeks (default 4) and ranks products
 * by units sold. Designed to answer two questions for the store owner:
 *   1. Which products fly off the shelf? (best-sellers — keep them in stock)
 *   2. Which products barely sell but still tie up cash? (slow-movers — skip
 *      the next restock, or run a promo to clear them)
 *
 * Returns:
 *   - range: { start, end, weeks }
 *   - bestSellers: top 10 by qtySold (with revenue, lastSoldAt, current stock)
 *   - slowMovers: bottom 10 by qtySold (with tied-up capital = unitCost * stock)
 *   - summary: totalRevenue, totalUnitsSold, distinctProductsSold,
 *              activeSkuCount, slowMoverTiedCapital, zeroSaleProducts
 *   - rows: full ranked list (so the UI can sort/filter further)
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError, withAdmin } from "@/lib/api";

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const weeks = Math.max(1, Math.min(52, parseInt(url.searchParams.get("weeks") ?? "4", 10) || 4));
    const end = new Date();
    const start = new Date(end.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);

    // All products (so zero-sale products show up as slow-movers).
    const products = await db.product.findMany({ where: { isActive: true } });
    // SaleItems in range, joined to product.
    const saleItems = await db.saleItem.findMany({
      where: { sale: { createdAt: { gte: start, lt: end } } },
      include: { product: true, sale: { select: { createdAt: true } } },
    });

    // Aggregate per product.
    type Row = {
      productId: string;
      name: string;
      category: string;
      qtySold: number;
      revenue: number;
      saleCount: number;        // number of distinct sales that included this product
      lastSoldAt: Date | null;
      currentStock: number;
      unitCost: number;
      sellPrice: number;
      stockValue: number;        // unitCost * currentStock (capital tied up)
      lowStockThreshold: number;
      weeksSinceLastSale: number | null;
    };

    const byProduct = new Map<string, Row>();
    for (const p of products) {
      byProduct.set(p.id, {
        productId: p.id,
        name: p.name,
        category: p.category,
        qtySold: 0,
        revenue: 0,
        saleCount: 0,
        lastSoldAt: null,
        currentStock: p.stock,
        unitCost: p.unitCost,
        sellPrice: p.sellPrice,
        stockValue: p.unitCost * p.stock,
        lowStockThreshold: p.lowStockThreshold,
        weeksSinceLastSale: null,
      });
    }

    for (const item of saleItems) {
      const row = byProduct.get(item.productId);
      if (!row) continue;
      row.qtySold += item.quantity;
      row.revenue += item.subtotal;
      row.saleCount += 1;
      const soldAt = item.sale.createdAt;
      if (!row.lastSoldAt || new Date(soldAt) > new Date(row.lastSoldAt)) {
        row.lastSoldAt = soldAt;
      }
    }

    // Compute weeks since last sale (relative to `end`).
    for (const row of byProduct.values()) {
      if (row.lastSoldAt) {
        const diffMs = end.getTime() - new Date(row.lastSoldAt).getTime();
        row.weeksSinceLastSale = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
      }
    }

    const rows = Array.from(byProduct.values()).sort((a, b) => b.qtySold - a.qtySold);

    const bestSellers = rows.slice(0, 10);
    // Slow movers: products with the lowest qtySold, but only those that still
    // have stock on hand (otherwise there's nothing to "skip restocking" for).
    const slowMovers = rows
      .filter((r) => r.currentStock > 0)
      .slice(-10)
      .reverse(); // worst first

    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
    const totalUnitsSold = rows.reduce((s, r) => s + r.qtySold, 0);
    const distinctProductsSold = rows.filter((r) => r.qtySold > 0).length;
    const zeroSaleProducts = rows.filter((r) => r.qtySold === 0).length;
    const slowMoverTiedCapital = slowMovers.reduce((s, r) => s + r.stockValue, 0);

    return ok({
      range: { start, end, weeks },
      summary: {
        totalRevenue,
        totalUnitsSold,
        distinctProductsSold,
        activeSkuCount: products.length,
        zeroSaleProducts,
        slowMoverTiedCapital,
      },
      bestSellers,
      slowMovers,
      rows,
    });
  } catch (e) {
    return serverError("Failed to compute analytics", e);
  }
});
