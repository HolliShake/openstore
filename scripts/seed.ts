/**
 * OpenStore — seeder.
 *
 * 1. Creates the default admin user used by the NextAuth credentials provider
 *    (skipped if it already exists).
 * 2. Upserts the singleton store Config row with the default branding
 *    (storeName "OpenStore", default subtitle and welcome text, no images —
 *    the UI falls back to the built-in Store icon and gradient hero).
 *
 * Default admin credentials:
 *   username: admin
 *   password: openstore2026
 *
 * Run with: npm run seed   (or: bun run seed)
 */
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

const CONFIG_ID = "store-config";

async function seedAdmin() {
  const existing = await db.user.findUnique({ where: { username: "admin" } });
  if (existing) {
    console.log("Admin user already exists — skipped.");
    return;
  }
  const hashed = await bcrypt.hash("openstore2026", 10);
  await db.user.create({
    data: {
      username: "admin",
      password: hashed,
      name: "OpenStore Admin",
      role: "admin",
    },
  });
  console.log("Seeded admin user. username=admin  password=openstore2026");
}

async function seedConfig() {
  // Upsert: keep any custom branding already saved, only create defaults
  // when the row is missing (fresh database).
  const existing = await db.config.findUnique({ where: { id: CONFIG_ID } });
  if (existing) {
    console.log(
      `Store config already exists (storeName="${existing.storeName}") — kept as-is.`,
    );
    return;
  }
  const config = await db.config.create({
    data: {
      id: CONFIG_ID,
      storeName: "OpenStore",
      subtitle: "Neighborhood Store",
      brandImage: null, // null = built-in Store icon
      bannerImage: null, // null = built-in gradient hero
      welcomeText:
        "Browse what's on the shelf today. Prices updated in real time from our inventory system. Drop by the store to pick up your essentials.",
      currency: "PHP", // default Philippine Peso (see SUPPORTED_CURRENCIES)
    },
  });
  console.log(`Seeded store config. storeName="${config.storeName}"`);
}

async function main() {
  await seedAdmin();
  await seedConfig();
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
