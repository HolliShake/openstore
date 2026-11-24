/**
 * OpenStore — Stock-in (restock) API.
 * GET  /api/stock-in   (admin: list restocks)
 * POST /api/stock-in   (admin: record restock)
 *
 * POST body: { productId, quantity, unitCost, supplier?, note? }
 *   - Increments product.stock.
 *   - Updates product.unitCost to the latest purchase cost.
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, created, badRequest, serverError, withAdmin, readJson } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10) || 100, 500);
    const items = await db.stockIn.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { product: true },
    });
    return ok(items);
  } catch (e) {
    return serverError("Failed to fetch stock-ins", e);
  }
});

export const POST = withAdmin(async (req) => {
  const { data, error } = await readJson<{
    productId?: string;
    quantity?: number;
    unitCost?: number;
    supplier?: string;
    note?: string;
  }>(req);
  if (error) return badRequest(error);
  if (!data) return badRequest("Missing body");
  if (!data.productId) return badRequest("productId is required");
  if (!Number.isInteger(data.quantity) || (data.quantity ?? 0) <= 0)
    return badRequest("quantity must be a positive integer");
  if ((data.unitCost ?? 0) < 0) return badRequest("unitCost must be >= 0");

  try {
    // AUDIT: stamp the admin who recorded this restock.
    const user = await getAuthUser();
    const result = await db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: data.productId } });
      if (!product) throw new Error("Product not found");

      // ---- Weighted-average cost (WAC) ----
      // Blends this purchase into the product's effective cost per unit, so
      // buying the same item at different stores/prices is fully covered:
      //   newAvg = (currentStock × currentAvg + qtyIn × newCost) / (currentStock + qtyIn)
      // If stock is 0, the new purchase price becomes the average directly.
      const qty = data.quantity!;
      const cost = Number(data.unitCost ?? 0);
      const currentStock = product.stock;
      const newAvgCost =
        currentStock <= 0
          ? cost
          : (currentStock * product.unitCost + qty * cost) / (currentStock + qty);

      const stockIn = await tx.stockIn.create({
        data: {
          productId: product.id,
          quantity: qty,
          unitCost: cost,
          supplier: data.supplier ?? null,
          note: data.note ?? null,
          // AUDIT TRAIL: which admin recorded this restock.
          userId: user?.id ?? null,
          createdBy: user?.label ?? null,
        },
      });
      // Increment stock + store the blended average cost.
      await tx.product.update({
        where: { id: product.id },
        data: {
          stock: { increment: qty },
          unitCost: newAvgCost,
        },
      });
      return stockIn;
    });
    return created(result);
  } catch (e) {
    return serverError("Failed to record stock-in", e);
  }
});
