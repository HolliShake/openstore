/**
 * One-off migration for the OpenStore rename:
 *  1. Config singleton row: storeName "AlRedStore" -> "OpenStore" (only if
 *     the admin has not customised it to something else).
 *  2. Admin user: password -> "openstore2026" (default credentials follow
 *     the new project name; re-hash with bcrypt).
 *
 * Run with: bun run scripts/rename-openstore.ts
 */
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

const CONFIG_ID = "store-config";

async function main() {
  // 1. Config row — only rewrite the old default, never a custom name.
  const config = await db.config.findUnique({ where: { id: CONFIG_ID } });
  if (config?.storeName === "AlRedStore") {
    await db.config.update({
      where: { id: CONFIG_ID },
      data: { storeName: "OpenStore" },
    });
    console.log('Config storeName updated: "AlRedStore" -> "OpenStore"');
  } else {
    console.log(
      `Config storeName is "${config?.storeName ?? "(missing)"}" — left untouched.`,
    );
  }

  // 2. Admin default credentials follow the rename.
  const admin = await db.user.findUnique({ where: { username: "admin" } });
  if (admin) {
    const hashed = await bcrypt.hash("openstore2026", 10);
    await db.user.update({
      where: { id: admin.id },
      data: { password: hashed, name: "OpenStore Admin" },
    });
    console.log('Admin password reset to "openstore2026".');
  } else {
    console.log("No admin user found — seed will create one.");
  }
}

main()
  .catch((err) => {
    console.error("Rename migration failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
