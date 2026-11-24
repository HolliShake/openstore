/**
 * OpenStore — User by id API. ADMIN ONLY.
 * PATCH  /api/users/[id]   (admin: update name/username/role, reset password)
 * DELETE /api/users/[id]   (admin: delete a staff account)
 *
 * PATCH body (all fields optional): { username?, name?, role?, password? }
 *   - password, when provided, replaces the current one (min 6 chars).
 *   - When a user is deleted, their historical sales keep the createdBy name
 *     snapshot, so the audit trail stays readable.
 *
 * Safety rules:
 *   - You cannot delete your own account.
 *   - The store must always keep at least one admin (blocks deleting the last
 *     admin or demoting them to cashier).
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, notFound, badRequest, serverError, withAdmin, readJson } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import bcrypt from "bcryptjs";

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,30}$/;
const PUBLIC_SELECT = {
  id: true,
  username: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const PATCH = withAdmin(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const { data, error } = await readJson<{
      username?: string;
      name?: string | null;
      role?: string;
      password?: string;
    }>(req);
    if (error) return badRequest(error);
    if (!data) return badRequest("Missing body");

    try {
      const target = await db.user.findUnique({ where: { id } });
      if (!target) return notFound("User not found");

      const update: Record<string, unknown> = {};

      if (data.username !== undefined) {
        const username = data.username.trim();
        if (!USERNAME_RE.test(username))
          return badRequest("Username must be 3–30 characters (letters, numbers, . _ -)");
        if (username !== target.username) {
          const clash = await db.user.findUnique({ where: { username } });
          if (clash) return badRequest(`Username "${username}" is already taken`);
        }
        update.username = username;
      }

      if (data.name !== undefined) {
        const name = (data.name ?? "").trim();
        update.name = name || null;
      }

      if (data.role !== undefined) {
        if (data.role !== "admin" && data.role !== "cashier")
          return badRequest('role must be "admin" or "cashier"');
        if (target.role === "admin" && data.role !== "admin") {
          // Demoting an admin: make sure another admin remains.
          const adminCount = await db.user.count({ where: { role: "admin" } });
          if (adminCount <= 1)
            return badRequest("Cannot demote the last admin — promote another admin first");
        }
        update.role = data.role;
      }

      if (data.password !== undefined && data.password !== "") {
        if (data.password.length < 6)
          return badRequest("Password must be at least 6 characters");
        update.password = await bcrypt.hash(data.password, 10);
      }

      if (Object.keys(update).length === 0) return badRequest("Nothing to update");

      const user = await db.user.update({ where: { id }, data: update, select: PUBLIC_SELECT });
      return ok(user);
    } catch (e) {
      return serverError("Failed to update user", e);
    }
  },
);

export const DELETE = withAdmin(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    try {
      const me = await getAuthUser();
      if (me?.id === id) return badRequest("You cannot delete your own account while signed in");

      const target = await db.user.findUnique({ where: { id } });
      if (!target) return notFound("User not found");

      if (target.role === "admin") {
        const adminCount = await db.user.count({ where: { role: "admin" } });
        if (adminCount <= 1)
          return badRequest("Cannot delete the last admin — promote another admin first");
      }

      // Sales/stock-ins/losses/expenses keep userId with onDelete: SetNull and
      // the createdBy name snapshot, so the audit history remains intact.
      await db.user.delete({ where: { id } });
      return ok({ deleted: true, id });
    } catch (e) {
      return serverError("Failed to delete user", e);
    }
  },
);
