/**
 * OpenStore — Users (staff accounts) API. ADMIN ONLY.
 * GET  /api/users   (admin: list staff accounts — password hashes never returned)
 * POST /api/users   (admin: create a cashier or another admin)
 *
 * POST body: { username, password, name?, role? }
 *   - username: 3–30 chars, letters/digits/._- , unique
 *   - password: min 6 chars (bcrypt-hashed before storage)
 *   - role: "cashier" (default) | "admin"
 *
 * Every sale/stock-in/loss/expense records who made it (audit trail), so the
 * admin knows exactly which cashier or admin performed each transaction.
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, created, badRequest, serverError, withAdmin, readJson } from "@/lib/api";
import bcrypt from "bcryptjs";

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,30}$/;

/** Fields safe to return to the client (never the password hash). */
const PUBLIC_SELECT = {
  id: true,
  username: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const GET = withAdmin(async () => {
  try {
    const users = await db.user.findMany({
      select: { ...PUBLIC_SELECT, _count: { select: { sales: true } } },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });
    return ok(users);
  } catch (e) {
    return serverError("Failed to fetch users", e);
  }
});

export const POST = withAdmin(async (req: NextRequest) => {
  const { data, error } = await readJson<{
    username?: string;
    password?: string;
    name?: string;
    role?: string;
  }>(req);
  if (error) return badRequest(error);
  if (!data) return badRequest("Missing body");

  const username = (data.username ?? "").trim();
  const password = data.password ?? "";
  const name = (data.name ?? "").trim();
  const role = data.role ?? "cashier";

  if (!USERNAME_RE.test(username))
    return badRequest("Username must be 3–30 characters (letters, numbers, . _ -)");
  if (password.length < 6) return badRequest("Password must be at least 6 characters");
  if (role !== "admin" && role !== "cashier")
    return badRequest('role must be "admin" or "cashier"');

  try {
    const clash = await db.user.findUnique({ where: { username } });
    if (clash) return badRequest(`Username "${username}" is already taken`);

    const user = await db.user.create({
      data: {
        username,
        password: await bcrypt.hash(password, 10),
        name: name || null,
        role,
      },
      select: PUBLIC_SELECT,
    });
    return created(user);
  } catch (e) {
    return serverError("Failed to create user", e);
  }
});
