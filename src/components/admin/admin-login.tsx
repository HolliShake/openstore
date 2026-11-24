"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Store, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useStoreConfig } from "@/components/providers/config-provider";
import { toast } from "sonner";

/**
 * OpenStore — staff login screen (admin & cashiers).
 * Shown at /login. Uses NextAuth credentials provider.
 * Admin default credentials (from scripts/seed.ts):
 *   username: admin   password: openstore2026
 * Cashiers use the accounts created in the admin “Cashiers” section.
 */
export function AdminLogin() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/admin";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { config } = useStoreConfig();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) {
      toast.error("Enter your username and password");
      return;
    }
    setLoading(true);
    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
      callbackUrl,
    });
    setLoading(false);
    if (!res || res.error) {
      toast.error("Invalid username or password");
      return;
    }
    toast.success("Welcome back!");
    // Hard navigation (not router.push): forces a full page reload so the
    // NextAuth session cookie is read server-side and useSession() initialises
    // to "authenticated" on first render. With router.push the client-side
    // session fetch can race the cookie and briefly report "unauthenticated",
    // which would trip the AdminApp guard and bounce back to login.
    window.location.href = callbackUrl;
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-muted/50 to-background px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Link
        href="/"
        className="absolute left-4 top-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to store
      </Link>

      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        {config.brandImage ? (
          <img
            src={config.brandImage}
            alt=""
            className="h-14 w-14 rounded-2xl object-cover shadow-lg"
          />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Store className="h-7 w-7" />
          </span>
        )}
        <div>
          <h1 className="text-xl font-bold">{config.storeName} Staff</h1>
          <p className="text-sm text-muted-foreground">
            Sign in as admin or cashier
          </p>
        </div>
      </div>

      <Card className="w-full max-w-sm shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Sign in</CardTitle>
          <CardDescription>
            Cashiers land on the checkout screen; admins get the full dashboard.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Admin default: <code className="font-mono">admin</code> /{" "}
              <code className="font-mono">openstore2026</code>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
