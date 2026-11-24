/**
 * OpenStore — NextAuth credentials provider.
 * Staff accounts with roles (see prisma/schema.prisma):
 *   - "admin"  : full access (inventory, reports, cashiers, POS, …)
 *   - "cashier": dashboard, POS, reports, and insights
 * Seeded by scripts/seed.ts (admin) and managed in the Cashiers section.
 */
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 }, // 7 days
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Staff",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        const user = await db.user.findUnique({
          where: { username: credentials.username },
        });
        if (!user) return null;
        const ok = await bcrypt.compare(credentials.password, user.password);
        if (!ok) return null;
        return {
          id: user.id,
          name: user.name ?? user.username,
          username: user.username,
          role: user.role,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? "";
        session.user.username = token.username ?? "";
        session.user.role = token.role ?? "admin";
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET ?? "openstore-dev-secret-change-me",
};

/** Server-side session helper. */
export async function getServerAuth() {
  return import("next-auth").then((m) => m.getServerSession(authOptions));
}

/** The signed-in staff member (admin or cashier), or null. */
export type AuthUser = {
  id: string;
  username: string;
  name: string | null;
  role: "admin" | "cashier" | string;
  /** Best display label: real name if set, else username. */
  label: string;
};

/** Returns the signed-in user (admin OR cashier) or null. */
export async function getAuthUser(): Promise<AuthUser | null> {
  const session = await getServerAuth();
  const u = session?.user as
    | { id?: string; username?: string; name?: string | null; role?: string }
    | undefined;
  if (!u?.id || !u.username) return null;
  return {
    id: u.id,
    username: u.username,
    name: u.name ?? null,
    role: u.role ?? "admin",
    label: u.name || u.username,
  };
}

/** Returns true if the current request is from an authenticated admin. */
export async function requireAdmin() {
  const user = await getAuthUser();
  return user?.role === "admin";
}

/** Returns the admin user, or null (for handlers that also need the identity). */
export async function requireAdminUser(): Promise<AuthUser | null> {
  const user = await getAuthUser();
  return user?.role === "admin" ? user : null;
}

/** Returns true if the current request is from any authenticated staff
 *  member — admin OR cashier. Used by the POS sales endpoints. */
export async function requireStaff() {
  return !!(await getAuthUser());
}
