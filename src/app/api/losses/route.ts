/**
 * OpenStore — Loss API.
 * GET  /api/losses   (admin: list loss events)
 * POST /api/losses   (admin: record a loss)
 *
 * POST body: { productId, quantity, reason, note? }
 *   reason: spoilage | damage | expired | missing | other
 *   - Captures product.unitCost at time of loss (so historical value is fixed).
 *   - For "missing" (unsold stock gap): also decrements stock to bring it in line.
 *   - For spoilage/damage/expired: decrements stock as well (item is gone).
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, created, badRequest, serverError, withAdmin, readJson } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { paginationResult, parsePagination } from "@/lib/pagination";

const REASONS = ["spoilage", "damage", "expired", "missing", "other"];

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const parsedPagination = parsePagination(url);
    if (parsedPagination.error) return badRequest(parsedPagination.error);
    const pagination = parsedPagination.pagination;
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "200", 10) || 200, 500);
    const [items, total, lossValueRows] = await Promise.all([
      db.loss.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: pagination?.pageSize ?? limit,
        ...(pagination ? { skip: pagination.skip } : {}),
        include: { product: true },
      }),
      pagination ? db.loss.count() : Promise.resolve(0),
      pagination
        ? db.$queryRaw<{ totalLossValue: number }[]>`
            SELECT COALESCE(SUM("unitCost" * "quantity"), 0) AS "totalLossValue"
            FROM "Loss"
          `
        : Promise.resolve([]),
    ]);
    if (!pagination) return ok(items);

    return ok({
      ...paginationResult(items, total, pagination),
      totalLossValue: lossValueRows[0]?.totalLossValue ?? 0,
    });
  } catch (e) {
    return serverError("Failed to fetch losses", e);
  }
});

export const POST = withAdmin(async (req) => {
  const { data, error } = await readJson<{
    productId?: string;
    quantity?: number;
    reason?: string;
    note?: string;
  }>(req);
  if (error) return badRequest(error);
  if (!data) return badRequest("Missing body");
  if (!data.productId) return badRequest("productId is required");
  if (!Number.isInteger(data.quantity) || (data.quantity ?? 0) <= 0)
    return badRequest("quantity must be a positive integer");
  if (!data.reason || !REASONS.includes(data.reason))
    return badRequest(`reason must be one of: ${REASONS.join(", ")}`);

  try {
    // AUDIT: stamp the admin who recorded this loss.
    const user = await getAuthUser();
    const result = await db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: data.productId } });
      if (!product) throw new Error("Product not found");
      if (product.stock < (data.quantity ?? 0))
        throw new Error(
          `Cannot record loss greater than current stock (${product.stock}) for "${product.name}"`,
        );
      const loss = await tx.loss.create({
        data: {
          productId: product.id,
          quantity: data.quantity!,
          reason: data.reason!,
          note: data.note ?? null,
          unitCost: product.unitCost,
          // AUDIT TRAIL: which admin recorded this loss.
          userId: user?.id ?? null,
          createdBy: user?.label ?? null,
        },
      });
      // Remove the lost units from inventory.
      await tx.product.update({
        where: { id: product.id },
        data: { stock: { decrement: data.quantity! } },
      });
      return loss;
    });
    return created(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to record loss";
    return badRequest(msg);
  }
});
