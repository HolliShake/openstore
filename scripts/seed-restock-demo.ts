/**
 * OpenStore — Demo sales seed for the grocery/restock list feature.
 * Creates backdated sales over the last 4 weeks so the restock-list API has
 * meaningful sales velocities to rank priorities against. Safe to re-run:
 * it deletes only sales created by this script (tagged via a marker payment
 * value "demo-restock") before inserting fresh ones.
 *
 * Run with: bun run scripts/seed-restock-demo.ts
 */
import { db } from "@/lib/db";

const DAYS = 24 * 60 * 60 * 1000;

async function main() {
  // Clean previous demo sales from this script.
  const old = await db.sale.findMany({
    where: { payment: "demo-restock" },
    select: { id: true },
  });
  if (old.length) {
    await db.sale.deleteMany({ where: { id: { in: old.map((s) => s.id) } } });
    console.log(`Removed ${old.length} previous demo sales.`);
  }

  // Ensure the demo products exist.
  const products = [
    // name, category, unitCost, sellPrice, stock, threshold
    { name: "Coke Mismo 300ml", category: "other", unitCost: 14, sellPrice: 20, stock: 2, lowStockThreshold: 6 },
    { name: "Bear Brand Sterilized 33g", category: "other", unitCost: 11, sellPrice: 15, stock: 0, lowStockThreshold: 8 },
    { name: "Piattos Cheese 40g", category: "biscuits", unitCost: 15, sellPrice: 22, stock: 4, lowStockThreshold: 3 },
    { name: "Lucky Me Pancit Canton 60g", category: "processed-meat", unitCost: 13, sellPrice: 18, stock: 12, lowStockThreshold: 6 },
  ];
  for (const p of products) {
    const existing = await db.product.findFirst({ where: { name: p.name } });
    if (existing) {
      await db.product.update({
        where: { id: existing.id },
        data: { stock: p.stock, lowStockThreshold: p.lowStockThreshold, isActive: true },
      });
    } else {
      await db.product.create({ data: p });
    }
  }
  const ids = new Map(
    (await db.product.findMany({ where: { name: { in: products.map((p) => p.name) } } })).map(
      (p) => [p.name, p],
    ),
  );

  // Backdated sales spread across the last 4 weeks.
  // velocity targets: Coke ~8/wk (fast), Bear Brand ~6/wk (fast, out of stock),
  // Piattos ~3/wk (medium), Pancit Canton ~1.5/wk (slow but stocked)
  const plan: { name: string; daysAgo: number; qty: number }[] = [];
  const push = (name: string, daysAgo: number, qty: number) => plan.push({ name, daysAgo, qty });

  for (const w of [3, 2, 1, 0]) {
    const base = w * 7;
    push("Coke Mismo 300ml", base + 1, 4); // ~8/wk
    push("Coke Mismo 300ml", base + 4, 4);
    push("Bear Brand Sterilized 33g", base + 2, 3); // ~6/wk
    push("Bear Brand Sterilized 33g", base + 5, 3);
    push("Piattos Cheese 40g", base + 3, 3); // ~3/wk
    push("Lucky Me Pancit Canton 60g", base + 6, w === 0 ? 2 : 1); // ~1.25/wk
  }

  for (const { name, daysAgo, qty } of plan) {
    const product = ids.get(name);
    if (!product) continue;
    await db.sale.create({
      data: {
        total: qty * product.sellPrice,
        payment: "demo-restock",
        createdAt: new Date(Date.now() - daysAgo * DAYS),
        items: {
          create: {
            productId: product.id,
            quantity: qty,
            unitPrice: product.sellPrice,
            unitCost: product.unitCost,
            subtotal: qty * product.sellPrice,
          },
        },
      },
    });
  }
  console.log(`Inserted ${plan.length} demo sales across 4 products.`);
  console.log("Expected restock-list result:");
  console.log("  critical: Bear Brand (out of stock, ~6/wk)");
  console.log("  high:     Coke Mismo (2 left, ~8/wk), Rebisco (low stock, 0 sales)");
  console.log("  medium:   Piattos (6 left, ~3/wk -> ~14d cover -> low/medium boundary)");
  console.log("  low:      Pancit Canton (12 left, ~1.25/wk -> ~67d cover -> NOT listed)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
