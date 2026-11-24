/**
 * OpenStore — Delete expense (admin).
 * DELETE /api/expenses/[id]
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, notFound, serverError, withAdmin } from "@/lib/api";

export const DELETE = withAdmin(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  try {
    const existing = await db.expense.findUnique({ where: { id } });
    if (!existing) return notFound("Expense not found");
    await db.expense.delete({ where: { id } });
    return ok({ id });
  } catch (e) {
    return serverError("Failed to delete expense", e);
  }
});
