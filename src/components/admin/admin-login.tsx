"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Store, Loader2, ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-16 size-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -right-32 bottom-0 size-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-4 sm:px-8">
        <Link
          href="/"
          className="inline-flex h-10 items-center gap-2 rounded-full border bg-background/80 px-4 text-sm font-medium text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to store
        </Link>
        <ThemeToggle />
      </header>

      <main className="relative grid min-h-screen place-items-center px-4 pb-8 pt-20 sm:px-8">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border bg-card shadow-2xl shadow-black/5 lg:grid-cols-[1.05fr_0.95fr] dark:shadow-black/25">
          <aside className="relative hidden min-h-[620px] flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/85 p-10 text-primary-foreground lg:flex xl:p-14">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -right-24 -top-20 size-80 rounded-full border border-primary-foreground/10" />
              <div className="absolute -right-8 top-[-4rem] size-64 rounded-full border border-primary-foreground/10" />
              <div className="absolute -bottom-40 -left-24 size-96 rounded-full bg-primary-foreground/5 blur-2xl" />
            </div>

            <div className="relative z-10 flex items-center gap-3">
              {config.brandImage ? (
                <img
                  src={config.brandImage}
                  alt=""
                  className="size-12 rounded-2xl object-cover ring-1 ring-primary-foreground/20"
                />
              ) : (
                <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-foreground/10 ring-1 ring-primary-foreground/15">
                  <Store className="h-6 w-6" />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate font-semibold">{config.storeName}</p>
                <p className="text-sm text-primary-foreground/65">Staff workspace</p>
              </div>
            </div>

            <div className="relative z-10 max-w-md">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary-foreground/15 bg-primary-foreground/10 px-3 py-1.5 text-xs font-medium text-primary-foreground/80">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                OpenStore staff portal
              </p>
              <h2 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
                Your store,
                <br />
                ready for today.
              </h2>
              <p className="mt-5 max-w-sm text-sm leading-6 text-primary-foreground/70">
                Sign in to manage checkout, inventory, and daily operations from one place.
              </p>
            </div>

            <div className="relative z-10 flex items-center gap-2 text-sm text-primary-foreground/65">
              <ShieldCheck className="h-4 w-4" />
              Admin and cashier access
            </div>
          </aside>

          <section className="flex flex-col justify-center p-6 sm:p-10 xl:p-14">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              {config.brandImage ? (
                <img
                  src={config.brandImage}
                  alt=""
                  className="size-11 rounded-xl object-cover shadow-sm"
                />
              ) : (
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  <Store className="h-5 w-5" />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate font-semibold">{config.storeName}</p>
                <p className="text-xs text-muted-foreground">Staff workspace</p>
              </div>
            </div>

            <div className="mb-8 space-y-2">
              <p className="text-sm font-medium text-primary">Staff access</p>
              <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
              <p className="text-sm leading-6 text-muted-foreground">
                Sign in as an admin or cashier to continue.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="h-11 rounded-xl bg-background px-3.5"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="h-11 rounded-xl bg-background px-3.5"
                  required
                />
              </div>
              <Button
                type="submit"
                className="h-11 w-full rounded-xl text-sm font-semibold shadow-sm"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="ml-auto h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

          </section>
        </div>
      </main>
    </div>
  );
}
