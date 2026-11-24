/**
 * OpenStore — Products API.
 * GET  /api/products             (public: list active products for storefront)
 * POST /api/products             (admin: create product)
 *
 * Query params (GET):
 *   ?category=canned-goods  filter by category
 *   ?q=rice                 search by name/barcode
 *   ?barcode=...            lookup by exact barcode (used by POS scanner)
 *   ?inStock=1              only products with stock available
 *   ?sort=name              order by product name
 *   ?includeInactive=1      (admin) include inactive products
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, created, badRequest, serverError, withAdmin, readJson } from "@/lib/api";
import { paginationResult, parsePagination } from "@/lib/pagination";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const parsedPagination = parsePagination(url);
    if (parsedPagination.error) return badRequest(parsedPagination.error);
    const pagination = parsedPagination.pagination;
    const category = url.searchParams.get("category") ?? undefined;
    const q = url.searchParams.get("q") ?? undefined;
    const barcode = url.searchParams.get("barcode") ?? undefined;
    const inStockOnly = url.searchParams.get("inStock") === "1";
    const sortByName = url.searchParams.get("sort") === "name";
    const includeInactive = url.searchParams.get("includeInactive") === "1";

    const where: Record<string, unknown> = {};
    if (category && category !== "all") where.category = category;
    if (barcode) where.barcode = barcode;
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { barcode: { contains: q } },
      ];
    }
    if (inStockOnly) where.stock = { gt: 0 };
    if (!includeInactive) where.isActive = true;

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        orderBy: sortByName
          ? [{ name: "asc" }, { id: "asc" }]
          : [{ category: "asc" }, { name: "asc" }, { id: "asc" }],
        ...(pagination
          ? { skip: pagination.skip, take: pagination.pageSize }
          : {}),
      }),
      pagination ? db.product.count({ where }) : Promise.resolve(0),
    ]);

    return ok(pagination ? paginationResult(products, total, pagination) : products);
  } catch (e) {
    return serverError("Failed to fetch products", e);
  }
}

export const POST = withAdmin(async (req) => {
  const { data, error } = await readJson<{
    name?: string;
    category?: string;
    barcode?: string | null;
    unitCost?: number;
    sellPrice?: number;
    stock?: number;
    lowStockThreshold?: number;
    imageUrl?: string | null;
    imageData?: string | null;
    description?: string;
  }>(req);
  if (error) return badRequest(error);
  if (!data) return badRequest("Missing body");
  const name = (data.name ?? "").trim();
  if (!name) return badRequest("Product name is required");
  if (data.sellPrice === undefined || data.sellPrice < 0)
    return badRequest("sellPrice must be >= 0");

  // Reject duplicate barcode if provided.
  if (data.barcode) {
    const clash = await db.product.findUnique({ where: { barcode: data.barcode } });
    if (clash) return badRequest("Another product already uses this barcode");
  }

  try {
    const product = await db.product.create({
      data: {
        name,
        category: data.category ?? "other",
        barcode: data.barcode ?? null,
        unitCost: Number(data.unitCost ?? 0),
        sellPrice: Number(data.sellPrice ?? 0),
        stock: Number(data.stock ?? 0),
        lowStockThreshold: Number(data.lowStockThreshold ?? 5),
        imageUrl: data.imageUrl ?? null,
        imageData: data.imageData ?? null,
        description: data.description ?? null,
      },
    });
    return created(product);
  } catch (e) {
    return serverError("Failed to create product", e);
  }
});
