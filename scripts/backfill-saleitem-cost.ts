/**
 * OpenStore — one-time backfill.
 * Sets SaleItem.unitCost (new column) for historical rows using the product's
 * current unit cost. Only touches rows where unitCost is still 0.
 *
 * Run with: bun run scripts/backfill-saleitem-cost.ts
 */
import { db } from "@/lib/db";

async function main() {
  const items = await db.saleItem.findMany({
    where: { unitCost: 0 },
    include: { product: { select: { id: true, unitCost: true } } },
  });
  if (items.length === 0) {
    console.log("Backfill: nothing to do (no sale items with unitCost = 0).");
    return;
  }
  let n = 0;
  for (const item of items) {
    await db.saleItem.update({
      where: { id: item.id },
      data: { unitCost: item.product.unitCost },
    });
    n++;
  }
  console.log(`Backfill: set unitCost on ${n} sale item(s).`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
