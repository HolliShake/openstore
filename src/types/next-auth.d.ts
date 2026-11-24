/**
 * OpenStore — NextAuth type augmentation.
 * Extends the JWT token and session user with our staff fields
 * (id, username, role) so client components can read them type-safely.
 */
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    username?: string;
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    username?: string;
    role?: string;
  }
}
