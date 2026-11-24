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
  { name: "Argentina Corned Beef 380g", category: "canned-goods", unitCost: 60, sellPrice: 75, stock: 24, lowStockThreshold: 6, barcode: "4800015112345", imageUrl: "https://img.lazcdn.com/g/p/7e7d9154b98ab55525b9bac72a1f42ff.png_720x720q80.png" },
  { name: "Century Tuna Flakes 155g", category: "canned-goods", unitCost: 32, sellPrice: 45, stock: 36, lowStockThreshold: 8, imageUrl: "https://centurytuna.ph/wp-content/uploads/2020/12/flakes-in-oil-180g-REV.png" },
  { name: "Mega Sardines Tomato 155g", category: "canned-goods", unitCost: 28, sellPrice: 38, stock: 30, lowStockThreshold: 6, imageUrl: "https://smmarkets.ph/media/catalog/product/2/0/20100191-PC-4_15.png?optimize=low&bg-color=255,255,255&fit=bounds&height=&width=" },
  { name: "Del Monte Pineapple Chunks 432g", category: "canned-goods", unitCost: 55, sellPrice: 70, stock: 12, lowStockThreshold: 4, imageUrl: "https://smmarkets.ph/media/catalog/product/1/0/10219127-PC-4_3.png?optimize=low&bg-color=255,255,255&fit=bounds&height=&width=" },

  // Rice
  { name: "Jasmine Rice 1kg", category: "rice", unitCost: 55, sellPrice: 68, stock: 40, lowStockThreshold: 10, imageUrl: "https://smmarkets.ph/media/catalog/product/2/0/20010964-PC-4_6.png?optimize=low&bg-color=255,255,255&fit=bounds&height=&width=" },
  { name: "Sinandomeng Rice 5kg", category: "rice", unitCost: 280, sellPrice: 340, stock: 8, lowStockThreshold: 3, imageUrl: "https://smmarkets.ph/media/catalog/product/1/0/10164673-PC-4_12.png?optimize=low&bg-color=255,255,255&fit=bounds&height=&width=" },
  { name: "Dinorado Rice 1kg", category: "rice", unitCost: 70, sellPrice: 88, stock: 15, lowStockThreshold: 5, imageUrl: "https://smmarkets.ph/media/catalog/product/1/0/10163575-PC-4.png?optimize=low&bg-color=255,255,255&fit=bounds&height=&width=" },

  // Fresh meat
  { name: "Pork Liempo per kg", category: "fresh-meat", unitCost: 320, sellPrice: 380, stock: 6, lowStockThreshold: 3, imageUrl: "https://images.unsplash.com/photo-1623047437095-27418540c288?auto=format&fit=crop&w=800&q=80" },
  { name: "Beef Pares per kg", category: "fresh-meat", unitCost: 380, sellPrice: 450, stock: 4, lowStockThreshold: 2, imageUrl: "https://images.unsplash.com/photo-1723893905879-0e309c2a8e06?auto=format&fit=crop&w=800&q=80" },
  { name: "Whole Chicken per kg", category: "fresh-meat", unitCost: 170, sellPrice: 200, stock: 10, lowStockThreshold: 4, imageUrl: "https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=800&q=80" },

  // Processed meat
  { name: "Purefoods Hotdog Jumbo 500g", category: "processed-meat", unitCost: 130, sellPrice: 160, stock: 18, lowStockThreshold: 5, barcode: "4800015190088", imageUrl: "https://www.dmc.com.ph/web/image/product.template/1047/image_1920?unique=98390f9" },
  { name: "CDO Holiday Ham 250g", category: "processed-meat", unitCost: 145, sellPrice: 180, stock: 9, lowStockThreshold: 4, imageUrl: "https://smmarkets.ph/media/catalog/product/2/0/20213888-PC-4_11.png?optimize=low&bg-color=255,255,255&fit=bounds&height=&width=" },
  { name: "Pampanga's Best Longganisa 250g", category: "processed-meat", unitCost: 110, sellPrice: 138, stock: 14, lowStockThreshold: 5, imageUrl: "https://smmarkets.ph/media/catalog/product/2/0/20221005-PC-4_9.png?optimize=low&bg-color=255,255,255&fit=bounds&height=&width=" },
  { name: "CDO Chorizo Bilbao 250g", category: "processed-meat", unitCost: 95, sellPrice: 120, stock: 11, lowStockThreshold: 4, imageUrl: "https://smmarkets.ph/media/catalog/product/2/0/20023693003-PK1-4_1.png?optimize=low&bg-color=255,255,255&fit=bounds&height=&width=" },

  // Biscuits & snacks
  { name: "Presto Peanut Butter 25g", category: "biscuits", unitCost: 6, sellPrice: 9, stock: 60, lowStockThreshold: 12, barcode: "4800015220010", imageUrl: "https://store.iloilosupermart.com/wp-content/uploads/2020/10/5454-1.jpg" },
  { name: "Fudgee Bar Choco 22g", category: "biscuits", unitCost: 7, sellPrice: 10, stock: 48, lowStockThreshold: 10, barcode: "4800015220027", imageUrl: "https://www.rebisco.com.ph/830-large_default_2x/fudgee-barr-chocolate.jpg" },
  { name: "SkyFlakes Crackers 3-pack", category: "biscuits", unitCost: 12, sellPrice: 17, stock: 32, lowStockThreshold: 8, imageUrl: "https://smmarkets.ph/media/catalog/product/1/0/10009214-PC-4_8.png?optimize=low&bg-color=255,255,255&fit=bounds&height=&width=" },
  { name: "Rebisco Sandwich Cheese 22g", category: "biscuits", unitCost: 6, sellPrice: 9, stock: 4, lowStockThreshold: 10, imageUrl: "https://smmarkets.ph/media/catalog/product/2/0/20562585-PC-4_22.png?optimize=low&bg-color=255,255,255&fit=bounds&height=&width=" },
  { name: "Oishi Pillow 22g", category: "biscuits", unitCost: 5, sellPrice: 8, stock: 50, lowStockThreshold: 12, imageUrl: "https://img.lazcdn.com/g/ff/kf/S5c5acb0e86354222930a88718a94b9b35.jpg_720x720q80.jpg_.webp" },
];

async function main() {
  let created = 0;
  let updated = 0;
  for (const p of DEMO) {
    const existing = await db.product.findFirst({ where: { name: p.name } });
    if (existing) {
      await db.product.update({
        where: { id: existing.id },
        data: { imageUrl: p.imageUrl, imageData: null },
      });
      updated++;
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
        imageUrl: p.imageUrl,
        imageData: null,
      },
    });
    created++;
  }
  console.log(`Demo seed done. Created ${created}, updated images for ${updated} existing products.`);
}

main()
  .catch((err) => {
    console.error("Demo seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
