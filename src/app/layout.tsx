import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/lib/query-client";
import { SessionProvider } from "@/components/providers/session-provider";
import { ConfigProvider } from "@/components/providers/config-provider";
import { db } from "@/lib/db";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Dynamic metadata — page title/description follow the store Config row
 *  (admin-editable in the Settings section). Falls back to defaults if the
 *  DB row is missing or the DB is unreachable. */
export async function generateMetadata(): Promise<Metadata> {
  const fallback = {
    title: "OpenStore — Neighborhood Store Inventory & Audit",
    description:
      "OpenStore: a small-store inventory, POS and weekly audit system. Track products, sales, stock, spoilage losses, expenses and net profit.",
  };
  try {
    const config = await db.config.findUnique({ where: { id: "store-config" } });
    if (!config) return fallback;
    return {
      title: `${config.storeName} — ${config.subtitle || "Inventory & Audit"}`,
      description: `${config.storeName}: a small-store inventory, POS and weekly audit system. ${config.welcomeText}`,
      keywords: [
        config.storeName,
        "sari-sari store",
        "inventory system",
        "POS",
        "weekly audit",
        "revenue tracking",
      ],
      authors: [{ name: config.storeName }],
    };
  } catch {
    return fallback;
  }
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <SessionProvider>
            <QueryProvider>
              <ConfigProvider>
                {children}
                <Toaster />
                <SonnerToaster richColors position="top-right" />
              </ConfigProvider>
            </QueryProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
