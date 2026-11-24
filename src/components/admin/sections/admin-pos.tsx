"use client";

/**
 * OpenStore — POS / Checkout section.
 *
 * Flow:
 *  1. Pick a product (by search, by category, or by scanning its barcode).
 *  2. Adjust quantities in the cart (auto-clamped to current stock).
 *  3. Pick a payment method, then "Complete sale".
 *
 * The sale is recorded via POST /api/sales, which atomically:
 *  - creates the Sale + SaleItems
 *  - captures sell price at time of sale
 *  - decrements product.stock
 *
 * Recent sales are shown underneath.
 */
import { useCallback, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import {
  ScanLine,
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CheckCircle2,
  Package,
  Loader2,
  Receipt,
  UserRound,
  PenLine,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { queryKeys } from "@/lib/query-client";
import { formatDateTime } from "@/lib/format";
import { useMoney } from "@/hooks/use-money";
import { CATEGORIES, categoryEmoji, categoryLabel, PAYMENT_METHODS } from "@/lib/constants";
import { toast } from "sonner";
import { SectionHeading } from "@/components/admin/sections/admin-expenses";
import { BarcodeScannerDialog } from "@/components/admin/sections/barcode-scanner-dialog";

type Product = {
  id: string;
  name: string;
  category: string;
  barcode: string | null;
  unitCost: number;
  sellPrice: number;
  stock: number;
  lowStockThreshold: number;
  imageUrl: string | null;
  imageData: string | null;
  description: string | null;
};

type CartLine = { product: Product; quantity: number };

type Sale = {
  id: string;
  total: number;
  payment: string;
  customerName: string | null;
  note: string | null;
  /** Audit: which staff member (admin or cashier) recorded this sale. */
  createdBy: string | null;
  createdAt: string;
  items: { id: string }[];
};

export function AdminPOS() {
  const { money } = useMoney(); // configured currency
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState("cash");
  const [customerName, setCustomerName] = useState("");
  const [manualEntry, setManualEntry] = useState(false);
  const [saleAt, setSaleAt] = useState("");
  const [note, setNote] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: queryKeys.products,
    queryFn: async () => {
      const r = await fetch("/api/products");
      if (!r.ok) throw new Error("Failed to load products");
      return r.json();
    },
  });

  const { data: recentSales, isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: queryKeys.sales,
    queryFn: async () => {
      const r = await fetch("/api/sales?limit=10");
      if (!r.ok) throw new Error("Failed to load sales");
      return r.json();
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (input: {
      items: { productId: string; quantity: number }[];
      payment: string;
      customerName?: string;
      createdAt?: string;
      note?: string;
    }) => {
      const r = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error ?? "Failed to record sale");
      }
      return r.json();
    },
    onSuccess: (_data, variables) => {
      toast.success(
        variables.createdAt
          ? "Manual sale recorded with the actual date/time! Stock updated."
          : "Sale recorded! Stock updated.",
      );
      setCart([]);
      setCustomerName("");
      setManualEntry(false);
      setSaleAt("");
      setNote("");
      qc.invalidateQueries({ queryKey: queryKeys.sales });
      qc.invalidateQueries({ queryKey: queryKeys.products });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard() });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visibleProducts = useMemo(() => {
    if (!products) return [];
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => p.stock > 0)
      .filter((p) => category === "all" || p.category === category)
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.barcode ?? "").toLowerCase().includes(q),
      )
      .slice(0, 24);
  }, [products, query, category]);

  const total = cart.reduce((s, l) => s + l.product.sellPrice * l.quantity, 0);

  const addToCart = useCallback(
    (product: Product, qty: number = 1) => {
      setCart((prev) => {
        const existing = prev.find((l) => l.product.id === product.id);
        if (existing) {
          const nextQty = Math.min(existing.quantity + qty, product.stock);
          return prev.map((l) =>
            l.product.id === product.id ? { ...l, quantity: nextQty } : l,
          );
        }
        return [...prev, { product, quantity: Math.min(qty, product.stock) }];
      });
    },
    [],
  );

  const handleBarcode = useCallback(
    (barcode: string) => {
      if (!products) return;
      const found = products.find((p) => p.barcode && p.barcode === barcode);
      if (!found) {
        toast.error(`No product matches barcode "${barcode}"`);
        return;
      }
      if (found.stock <= 0) {
        toast.error(`"${found.name}" is out of stock`);
        return;
      }
      addToCart(found, 1);
      toast.success(`Added ${found.name}`);
      setScannerOpen(false);
    },
    [products, addToCart],
  );

  function updateQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.product.id !== productId) return l;
          const nextQty = Math.max(0, Math.min(l.quantity + delta, l.product.stock));
          return { ...l, quantity: nextQty };
        })
        .filter((l) => l.quantity > 0),
    );
  }

  function checkout() {
    if (cart.length === 0) return toast.error("Cart is empty");
    if (manualEntry && !saleAt)
      return toast.error("Pick the actual date & time of the paper-recorded sale");
    checkoutMutation.mutate({
      items: cart.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
      payment,
      customerName: customerName.trim() || undefined,
      // Manual/offline entry: send the actual sale moment as ISO.
      createdAt: manualEntry ? new Date(saleAt).toISOString() : undefined,
      note: manualEntry && note.trim() ? note.trim() : undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeading
          title="POS / Checkout"
          subtitle="Add products to the cart, then complete the sale. Stock is decremented automatically."
        />
        <Button variant="outline" onClick={() => setScannerOpen(true)}>
          <ScanLine className="mr-2 h-4 w-4" /> Scan barcode
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Product picker */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Products</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or barcode…"
                  className="pl-9"
                />
              </div>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.emoji} {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid max-h-[420px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
              {productsLoading ? (
                /* Skeleton tile grid while the product list loads */
                Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-1 rounded-lg border p-2">
                    <Skeleton className="aspect-square w-full rounded-md" />
                    <Skeleton className="h-3 w-4/5" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))
              ) : visibleProducts.length === 0 ? (
                <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
                  No products match.
                </div>
              ) : (
                visibleProducts.map((p) => {
                  const img = p.imageData ?? p.imageUrl;
                  return (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className="group flex flex-col gap-1 rounded-lg border p-2 text-left transition-all hover:border-primary/40 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
                        {img ? (
                          <Image
                            src={img}
                            alt={p.name}
                            fill
                            sizes="100px"
                            className="object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Package className="h-6 w-6 text-muted-foreground/40" />
                          </div>
                        )}
                      </div>
                      <div className="text-xs font-medium line-clamp-2 leading-tight">{p.name}</div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-primary">
                          {money(p.sellPrice)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {p.stock} left
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cart */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-4 w-4" /> Cart
              {cart.length > 0 && (
                <Badge variant="secondary">{cart.length} item(s)</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            {cart.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
                <ShoppingCart className="h-10 w-10 opacity-30" />
                <p>Tap a product to add it.</p>
                <p className="text-xs">Or use the barcode scanner for fast entry.</p>
              </div>
            ) : (
              <ul className="flex-1 space-y-2 overflow-y-auto pr-1">
                {cart.map((l) => (
                  <li
                    key={l.product.id}
                    className="flex items-center gap-2 rounded-md border p-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{l.product.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {money(l.product.sellPrice)} × {l.quantity}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => updateQty(l.product.id, -1)}
                        aria-label="Decrease"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm tabular-nums">{l.quantity}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => updateQty(l.product.id, 1)}
                        disabled={l.quantity >= l.product.stock}
                        aria-label="Increase"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => updateQty(l.product.id, -l.quantity)}
                        aria-label="Remove"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-xl font-bold tabular-nums text-primary">
                  {money(total)}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Customer:</span>
                  <div className="relative flex-1">
                    <UserRound className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Walk-in buyer (optional name)"
                      className="h-8 pl-7 text-xs"
                      aria-label="Customer name (leave blank for walk-in)"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Payment:</span>
                  <Select value={payment} onValueChange={setPayment}>
                    <SelectTrigger className="h-8 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Manual / offline paper-record entry */}
              <div className="rounded-md border border-dashed p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    <PenLine className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">Offline / paper record</span>
                  </div>
                  <Switch
                    checked={manualEntry}
                    onCheckedChange={setManualEntry}
                    aria-label="Toggle manual entry of a paper-recorded sale"
                  />
                </div>
                {manualEntry && (
                  <div className="mt-2.5 space-y-2">
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      Sale happened earlier (e.g. during a power or internet outage)? Enter
                      it from your paper list with the actual date &amp; time — reports will
                      count it on the right day.
                    </p>
                    <Input
                      type="datetime-local"
                      value={saleAt}
                      onChange={(e) => setSaleAt(e.target.value)}
                      className="h-8 text-xs"
                      aria-label="Actual date and time of the sale"
                    />
                    <Input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={200}
                      placeholder="Note (optional) — e.g. paper list, brownout Nov 22"
                      className="h-8 text-xs"
                      aria-label="Audit note for this manual entry"
                    />
                  </div>
                )}
              </div>
              <Button
                onClick={checkout}
                disabled={cart.length === 0 || checkoutMutation.isPending}
                className="w-full"
                size="lg"
              >
                {checkoutMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Complete sale
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent sales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4" /> Recent sales
          </CardTitle>
        </CardHeader>
        <CardContent>
          {salesLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (recentSales?.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No sales yet. Record your first sale above.
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-md">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Recorded by</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSales!.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(s.createdAt)}
                        {s.note && (
                          <Badge
                            variant="outline"
                            className="ml-1.5 h-4 px-1 text-[9px] font-normal text-muted-foreground"
                            title={s.note}
                          >
                            paper
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate text-xs">
                        {s.customerName ?? <span className="text-muted-foreground italic">Walk-in</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{s.items.length}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {s.payment}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[130px] truncate text-xs text-muted-foreground">
                        {s.createdBy ?? <span className="italic opacity-60">unknown</span>}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {money(s.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={handleBarcode}
      />
    </div>
  );
}
