/**
 * OpenStore — Product by id API.
 * GET    /api/products/[id]   (public)
 * PATCH  /api/products/[id]   (admin)
 * DELETE /api/products/[id]   (admin: soft delete — sets isActive=false)
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, notFound, badRequest, serverError, withAdmin, readJson } from "@/lib/api";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const product = await db.product.findUnique({ where: { id } });
    if (!product) return notFound("Product not found");
    return ok(product);
  } catch (e) {
    return serverError("Failed to fetch product", e);
  }
}

export const PATCH = withAdmin(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const { data, error } = await readJson<Record<string, unknown>>(req);
  if (error) return badRequest(error);
  if (!data) return badRequest("Missing body");

  // Whitelist updatable fields.
  const allowed: Record<string, unknown> = {};
  const keys = [
    "name",
    "category",
    "barcode",
    "unitCost",
    "sellPrice",
    "stock",
    "lowStockThreshold",
    "imageUrl",
    "imageData",
    "description",
    "isActive",
  ];
  for (const k of keys) if (k in data) allowed[k] = data[k];

  if (typeof allowed.barcode === "string" && allowed.barcode) {
    const clash = await db.product.findUnique({ where: { barcode: allowed.barcode } });
    if (clash && clash.id !== id) return badRequest("Another product already uses this barcode");
  }

  try {
    const updated = await db.product.update({ where: { id }, data: allowed });
    return ok(updated);
  } catch (e) {
    return serverError("Failed to update product", e);
  }
});

export const DELETE = withAdmin(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  try {
    // Soft-delete to preserve historical sales/loss references.
    const updated = await db.product.update({
      where: { id },
      data: { isActive: false },
    });
    return ok({ id: updated.id, isActive: false });
  } catch (e) {
    return serverError("Failed to delete product", e);
  }
});
