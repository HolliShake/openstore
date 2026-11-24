/**
 * OpenStore — Expenses API (non-COGS).
 * GET  /api/expenses   (admin: list expenses)
 * POST /api/expenses   (admin: create expense)
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, created, badRequest, serverError, withAdmin, readJson } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";

const CATEGORIES = ["utilities", "transport", "rent", "supplies", "other"];

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "200", 10) || 200, 500);
    const items = await db.expense.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return ok(items);
  } catch (e) {
    return serverError("Failed to fetch expenses", e);
  }
});

export const POST = withAdmin(async (req) => {
  const { data, error } = await readJson<{
    description?: string;
    amount?: number;
    category?: string;
  }>(req);
  if (error) return badRequest(error);
  if (!data) return badRequest("Missing body");
  const description = (data.description ?? "").trim();
  if (!description) return badRequest("description is required");
  if (typeof data.amount !== "number" || data.amount < 0)
    return badRequest("amount must be a positive number");
  if (data.category && !CATEGORIES.includes(data.category))
    return badRequest(`category must be one of: ${CATEGORIES.join(", ")}`);

  try {
    // AUDIT: stamp the admin who recorded this expense.
    const user = await getAuthUser();
    const expense = await db.expense.create({
      data: {
        description,
        amount: data.amount,
        category: data.category ?? "other",
        // AUDIT TRAIL: which admin recorded this expense.
        userId: user?.id ?? null,
        createdBy: user?.label ?? null,
      },
    });
    return created(expense);
  } catch (e) {
    return serverError("Failed to create expense", e);
  }
});
