/**
 * OpenStore — Sales API (POS checkout).
 * GET  /api/sales              (staff: list sales, optional ?week=current|prev|0..N)
 * POST /api/sales              (staff: record a new sale — admin or cashier)
 *
 * POST body: { items: [{productId, quantity}], payment?: string, customerName?: string,
 *              createdAt?: string, note?: string }
 *   - Captures the sellPrice at time of sale.
 *   - Atomically decrements product.stock.
 *   - Rejects when stock insufficient.
 *   - customerName is optional; blank/null = walk-in buyer.
 *   - createdAt is optional: for MANUAL entry of sales that happened earlier
 *     (e.g. recorded from a paper list after a power/internet outage). Must be
 *     in the past and within the last 90 days.
 *   - note is optional: short audit note for manual entries.
 *   - AUDIT: the signed-in user (admin or cashier) is stamped on every sale
 *     (userId + createdBy name snapshot) so you always know who made it.
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, created, badRequest, serverError, withStaff, readJson } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { weekRangeOffset } from "@/lib/format";
import { paginationResult, parsePagination } from "@/lib/pagination";
import { PAYMENT_METHODS } from "@/lib/constants";

export const GET = withStaff(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const parsedPagination = parsePagination(url);
    if (parsedPagination.error) return badRequest(parsedPagination.error);
    const pagination = parsedPagination.pagination;
    const weekParam = url.searchParams.get("week");
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "200", 10) || 200, 500);

    const where: Record<string, unknown> = {};
    if (weekParam !== null) {
      const offset = weekParam === "prev" ? 1 : Number(weekParam) || 0;
      const [start, end] = weekRangeOffset(offset);
      where.createdAt = { gte: start, lt: end };
    }

    const [sales, total] = await Promise.all([
      db.sale.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: pagination?.pageSize ?? limit,
        ...(pagination ? { skip: pagination.skip } : {}),
        include: { items: { include: { product: true } } },
      }),
      pagination ? db.sale.count({ where }) : Promise.resolve(0),
    ]);
    return ok(pagination ? paginationResult(sales, total, pagination) : sales);
  } catch (e) {
    return serverError("Failed to fetch sales", e);
  }
});

type SalePayload = {
  items: { productId: string; quantity: number }[];
  payment?: string;
  customerName?: string;
  createdAt?: string;
  note?: string;
};

/** Manual/backdated entries: how far back a paper-recorded sale may be dated. */
const MAX_BACKDATE_DAYS = 90;

export const POST = withStaff(async (req) => {
  const { data, error } = await readJson<SalePayload>(req);
  if (error) return badRequest(error);
  if (!data || !Array.isArray(data.items) || data.items.length === 0)
    return badRequest("Sale must include at least one item");
  const payment = data.payment ?? "cash";
  if (!PAYMENT_METHODS.some((method) => method.value === payment))
    return badRequest("payment must be cash or gcash");

  // AUDIT: stamp the signed-in staff member (admin or cashier) on this sale.
  const user = await getAuthUser();

  // Validate items + capture current sell price + check stock, all in one read.
  const productIds = data.items.map((i) => i.productId);
  const products = await db.product.findMany({ where: { id: { in: productIds } } });
  if (products.length !== productIds.length)
    return badRequest("One or more products do not exist");

  const lines: {
    product: (typeof products)[number];
    quantity: number;
    unitPrice: number;
    unitCost: number;
    subtotal: number;
  }[] = [];

  for (const item of data.items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0)
      return badRequest(`Quantity must be a positive integer`);
    const product = products.find((p) => p.id === item.productId)!;
    if (product.stock < item.quantity)
      return badRequest(`Insufficient stock for "${product.name}" (have ${product.stock})`);
    const unitPrice = product.sellPrice;
    // Snapshot the product's current weighted-average cost so COGS stays
    // historically exact even if the average changes after later restocks.
    const unitCost = product.unitCost;
    const subtotal = unitPrice * item.quantity;
    lines.push({ product, quantity: item.quantity, unitPrice, unitCost, subtotal });
  }

  const total = lines.reduce((s, l) => s + l.subtotal, 0);

  // ---- Manual / backdated entry support ----
  // When the store loses power/internet, sales are written on paper and
  // entered later. The admin provides the actual sale date/time; we validate
  // it is a real timestamp, not in the future, and not older than 90 days.
  let saleAt = new Date();
  if (data.createdAt !== undefined && data.createdAt !== null && data.createdAt !== "") {
    const parsed = new Date(data.createdAt);
    if (Number.isNaN(parsed.getTime())) return badRequest("createdAt must be a valid date/time");
    const now = new Date();
    if (parsed.getTime() > now.getTime() + 60_000)
      return badRequest("Sale date/time cannot be in the future");
    if (parsed.getTime() < now.getTime() - MAX_BACKDATE_DAYS * 24 * 60 * 60 * 1000)
      return badRequest(`Sale date/time cannot be more than ${MAX_BACKDATE_DAYS} days in the past`);
    saleAt = parsed;
  }
  const note = data.note?.trim() ? data.note.trim().slice(0, 200) : null;

  try {
    // Single transaction: create sale + items + decrement stock.
    const sale = await db.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          total,
          payment,
          // Optional buyer name; blank input means walk-in (null).
          customerName: data.customerName?.trim() ? data.customerName.trim() : null,
          // Audit note for manual/offline entries (e.g. "paper list, brownout").
          note,
          // AUDIT TRAIL: which staff member (admin/cashier) recorded this sale.
          userId: user?.id ?? null,
          createdBy: user?.label ?? null,
          // Actual sale moment — backdated for manual entries, now otherwise.
          createdAt: saleAt,
          items: {
            create: lines.map((l) => ({
              productId: l.product.id,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              unitCost: l.unitCost,
              subtotal: l.subtotal,
            })),
          },
        },
        include: { items: true },
      });
      // Decrement stock for each product.
      await Promise.all(
        lines.map((l) =>
          tx.product.update({
            where: { id: l.product.id },
            data: { stock: { decrement: l.quantity } },
          }),
        ),
      );
      return created;
    });
    return created(sale);
  } catch (e) {
    return serverError("Failed to record sale", e);
  }
});
