/**
 * OpenStore — Demo product seed.
 * Adds a handful of representative products per category so the storefront
 * and dashboard are populated on first run. Safe to re-run (idempotent by name).
 *
 * Run with: bun run scripts/seed-products.ts
 */
import { db } from "@/lib/db";

const DEMO = [
  // Canned goods
  { name: "Argentina Corned Beef 380g", category: "canned-goods", unitCost: 60, sellPrice: 75, stock: 24, lowStockThreshold: 6, barcode: "4800015112345" },
  { name: "Century Tuna Flakes 155g", category: "canned-goods", unitCost: 32, sellPrice: 45, stock: 36, lowStockThreshold: 8 },
  { name: "Mega Sardines Tomato 155g", category: "canned-goods", unitCost: 28, sellPrice: 38, stock: 30, lowStockThreshold: 6 },
  { name: "Del Monte Pineapple Chunks 432g", category: "canned-goods", unitCost: 55, sellPrice: 70, stock: 12, lowStockThreshold: 4 },

  // Rice
  { name: "Jasmine Rice 1kg", category: "rice", unitCost: 55, sellPrice: 68, stock: 40, lowStockThreshold: 10 },
  { name: "Sinandomeng Rice 5kg", category: "rice", unitCost: 280, sellPrice: 340, stock: 8, lowStockThreshold: 3 },
  { name: "Dinorado Rice 1kg", category: "rice", unitCost: 70, sellPrice: 88, stock: 15, lowStockThreshold: 5 },

  // Fresh meat
  { name: "Pork Liempo per kg", category: "fresh-meat", unitCost: 320, sellPrice: 380, stock: 6, lowStockThreshold: 3 },
  { name: "Beef Pares per kg", category: "fresh-meat", unitCost: 380, sellPrice: 450, stock: 4, lowStockThreshold: 2 },
  { name: "Whole Chicken per kg", category: "fresh-meat", unitCost: 170, sellPrice: 200, stock: 10, lowStockThreshold: 4 },

  // Processed meat
  { name: "Purefoods Hotdog Jumbo 500g", category: "processed-meat", unitCost: 130, sellPrice: 160, stock: 18, lowStockThreshold: 5, barcode: "4800015190088" },
  { name: "CDO Holiday Ham 250g", category: "processed-meat", unitCost: 145, sellPrice: 180, stock: 9, lowStockThreshold: 4 },
  { name: "Pampanga's Best Longganisa 250g", category: "processed-meat", unitCost: 110, sellPrice: 138, stock: 14, lowStockThreshold: 5 },
  { name: "CDO Chorizo Bilbao 250g", category: "processed-meat", unitCost: 95, sellPrice: 120, stock: 11, lowStockThreshold: 4 },

  // Biscuits & snacks
  { name: "Presto Peanut Butter 25g", category: "biscuits", unitCost: 6, sellPrice: 9, stock: 60, lowStockThreshold: 12, barcode: "4800015220010" },
  { name: "Fudgee Bar Choco 22g", category: "biscuits", unitCost: 7, sellPrice: 10, stock: 48, lowStockThreshold: 10, barcode: "4800015220027" },
  { name: "SkyFlakes Crackers 3-pack", category: "biscuits", unitCost: 12, sellPrice: 17, stock: 32, lowStockThreshold: 8 },
  { name: "Rebisco Sandwich Cheese 22g", category: "biscuits", unitCost: 6, sellPrice: 9, stock: 4, lowStockThreshold: 10 },
  { name: "Oishi Pillow 22g", category: "biscuits", unitCost: 5, sellPrice: 8, stock: 50, lowStockThreshold: 12 },
];

async function main() {
  let created = 0;
  let skipped = 0;
  for (const p of DEMO) {
    const existing = await db.product.findFirst({ where: { name: p.name } });
    if (existing) {
      skipped++;
      continue;
    }
    await db.product.create({
      data: {
        name: p.name,
        category: p.category,
        unitCost: p.unitCost,
        sellPrice: p.sellPrice,
        stock: p.stock,
        lowStockThreshold: p.lowStockThreshold,
        barcode: p.barcode ?? null,
      },
    });
    created++;
  }
  console.log(`Demo seed done. Created ${created}, skipped ${skipped} (already existed).`);
}

main()
  .catch((err) => {
    console.error("Demo seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
