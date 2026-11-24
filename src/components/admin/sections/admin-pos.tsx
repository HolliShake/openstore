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
import { useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import SelectInput from "@/components/common/select.component";
import DataTable from "@/components/common/table.component";
import Modal, { useModal } from "@/components/common/modal.component";
import ConfirmModal from "@/components/common/confirm.component";
import { queryKeys } from "@/lib/query-client";
import { DEFAULT_PAGE_SIZE, type PaginationResult } from "@/lib/pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
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

type SalePage = PaginationResult<Sale>;

type CheckoutResponse = {
  id: string;
  total: number;
  payment: string;
  amount: number;
  change: number;
};

export function AdminPOS() {
  const { money } = useMoney(); // configured currency
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState("cash");
  const [amountTendered, setAmountTendered] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [manualEntry, setManualEntry] = useState(false);
  const [saleAt, setSaleAt] = useState("");
  const [note, setNote] = useState("");
  const [salesPage, setSalesPage] = useState(1);
  const debouncedQuery = useDebouncedValue(query, 300);
  const scannerModal = useModal<void>();
  const changeModal = useModal<CheckoutResponse>();
  const removeCartModal = useModal<CartLine>();

  const { data: products, isLoading: productsLoading } = useQuery<
    PaginationResult<Product>
  >({
    queryKey: [...queryKeys.products, "pos", debouncedQuery, category],
    queryFn: async () => {
      const params = new URLSearchParams({
        inStock: "1",
        category,
        page: "1",
        pageSize: "24",
      });
      if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
      const r = await fetch(`/api/products?${params}`);
      if (!r.ok) throw new Error("Failed to load products");
      return r.json();
    },
  });

  const { data: recentSales, isLoading: salesLoading } = useQuery<SalePage>({
    queryKey: [...queryKeys.sales, salesPage],
    queryFn: async () => {
      const r = await fetch(
        `/api/sales?page=${salesPage}&pageSize=${DEFAULT_PAGE_SIZE}`,
      );
      if (!r.ok) throw new Error("Failed to load sales");
      return r.json();
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (input: {
      items: { productId: string; quantity: number }[];
      amount: number;
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
      return (await r.json()) as CheckoutResponse;
    },
    onSuccess: (result) => {
      changeModal.openFn(result);
      setCart([]);
      setAmountTendered("");
      setCustomerName("");
      setManualEntry(false);
      setSaleAt("");
      setNote("");
      setSalesPage(1);
      qc.invalidateQueries({ queryKey: queryKeys.sales });
      qc.invalidateQueries({ queryKey: queryKeys.products });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard() });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = cart.reduce((s, l) => s + l.product.sellPrice * l.quantity, 0);
  const cartUnitCount = cart.reduce((count, line) => count + line.quantity, 0);
  const visibleProducts = products?.items ?? [];

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
    async (barcode: string) => {
      try {
        const r = await fetch(`/api/products?barcode=${encodeURIComponent(barcode)}`);
        if (!r.ok) throw new Error("Failed to look up barcode");
        const matches = (await r.json()) as Product[];
        const found = matches[0];
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
        scannerModal.closeFn();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to look up barcode");
      }
    },
    [addToCart, scannerModal],
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
    if (payment === "cash" && !amountTendered.trim())
      return toast.error("Enter the cash amount received");
    checkoutMutation.mutate({
      items: cart.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
      amount: payment === "cash" ? Number(amountTendered) : total,
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
        <Button variant="outline" onClick={() => scannerModal.openFn(undefined)}>
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
              <SelectInput
                value={category}
                onChange={setCategory}
                className="w-full sm:w-44"
                options={[
                  { label: "All", value: "all" },
                  ...CATEGORIES.map((c) => ({
                    label: `${c.emoji} ${c.label}`,
                    value: c.value,
                  })),
                ]}
              />
            </div>
            <div className="grid max-h-105 grid-cols-2 gap-2 overflow-y-auto p-1 sm:grid-cols-3">
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
                      className="group flex flex-col gap-1 rounded-lg border p-2 text-left transition-all hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
                        {img ? (
                          <img
                            src={img}
                            alt={p.name}
                            className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105"
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
        <Card className="flex min-h-0 flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-4 w-4" /> Cart
              {cart.length > 0 && (
                <Badge variant="secondary">
                  {cartUnitCount} {cartUnitCount === 1 ? "item" : "items"}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
            {cart.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 px-5 py-10 text-center">
                <div className="rounded-full bg-background p-3 ring-1 ring-border">
                  <ShoppingCart className="h-6 w-6 text-muted-foreground/60" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Your cart is empty</p>
                  <p className="text-xs text-muted-foreground">
                    Tap a product or scan its barcode to get started.
                  </p>
                </div>
              </div>
            ) : (
              <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {cart.map((l) => {
                  const image = l.product.imageData ?? l.product.imageUrl;
                  return (
                    <li
                      key={l.product.id}
                      className="flex gap-3 rounded-xl border bg-background p-3 transition-colors hover:bg-muted/20"
                    >
                      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                        {image ? (
                          <img
                            src={image}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Package className="h-5 w-5 text-muted-foreground/50" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{l.product.name}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {money(l.product.sellPrice)} each
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-semibold tabular-nums">
                            {money(l.product.sellPrice * l.quantity)}
                          </p>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="inline-flex items-center gap-1 rounded-lg border bg-muted/20 p-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => updateQty(l.product.id, -1)}
                              aria-label={`Decrease ${l.product.name} quantity`}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="min-w-8 text-center text-sm font-medium tabular-nums">
                              {l.quantity}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => updateQty(l.product.id, 1)}
                              disabled={l.quantity >= l.product.stock}
                              aria-label={`Increase ${l.product.name} quantity`}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => removeCartModal.openFn(l)}
                            aria-label={`Remove ${l.product.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between rounded-xl bg-muted/35 px-3 py-2.5">
                <div>
                  <span className="block text-sm font-medium">Total</span>
                  <span className="text-xs text-muted-foreground">
                    {cartUnitCount} {cartUnitCount === 1 ? "item" : "items"}
                  </span>
                </div>
                <span className="text-xl font-bold tabular-nums text-primary">
                  {money(total)}
                </span>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-2">
                  <label htmlFor="customer-name" className="text-xs text-muted-foreground">
                    Customer:
                  </label>
                  <div className="relative min-w-0">
                    <UserRound className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="customer-name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Walk-in buyer (optional name)"
                      className="h-8 pl-7 text-xs"
                      aria-label="Customer name (leave blank for walk-in)"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-2">
                  <label htmlFor="payment-method" className="text-xs text-muted-foreground">
                    Payment:
                  </label>
                  <SelectInput
                    id="payment-method"
                    value={payment}
                    onChange={setPayment}
                    className="w-full"
                    size="default"
                    options={PAYMENT_METHODS.map((m) => ({
                      label: m.label,
                      value: m.value,
                    }))}
                  />
                </div>
                {payment === "cash" && (
                  <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-2">
                    <label htmlFor="cash-amount" className="text-xs text-muted-foreground">
                      Cash received:
                    </label>
                    <Input
                      id="cash-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={amountTendered}
                      onChange={(e) => setAmountTendered(e.target.value)}
                      placeholder="Amount"
                      className="h-8 w-full text-xs"
                      aria-label="Cash amount received"
                    />
                  </div>
                )}
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
          <DataTable
            data={recentSales?.items ?? []}
            isLoading={salesLoading}
            pagination={{
              page: salesPage,
              pageSize: DEFAULT_PAGE_SIZE,
              total: recentSales?.total ?? 0,
              onPageChange: setSalesPage,
            }}
            emptyState={
              <p className="py-8 text-center text-sm text-muted-foreground">
                No sales yet. Record your first sale above.
              </p>
            }
            rowKey={(sale) => sale.id}
            className="min-w-160"
            containerClassName="max-h-72 rounded-md"
            columns={[
              {
                header: "When",
                className: "whitespace-nowrap text-xs text-muted-foreground",
                render: (sale) => (
                  <>
                    {formatDateTime(sale.createdAt)}
                    {sale.note && (
                      <Badge
                        variant="outline"
                        className="ml-1.5 h-4 px-1 text-[9px] font-normal text-muted-foreground"
                        title={sale.note}
                      >
                        paper
                      </Badge>
                    )}
                  </>
                ),
              },
              {
                header: "Customer",
                className: "max-w-[140px] truncate text-xs",
                render: (sale) =>
                  sale.customerName ?? (
                    <span className="text-muted-foreground italic">Walk-in</span>
                  ),
              },
              {
                header: "Items",
                headerClassName: "text-right",
                className: "text-right tabular-nums",
                render: (sale) => sale.items.length,
              },
              {
                header: "Payment",
                render: (sale) => (
                  <Badge variant="outline" className="capitalize">
                    {sale.payment}
                  </Badge>
                ),
              },
              {
                header: "Recorded by",
                className: "max-w-[130px] truncate text-xs text-muted-foreground",
                render: (sale) =>
                  sale.createdBy ?? <span className="italic opacity-60">unknown</span>,
              },
              {
                header: "Total",
                headerClassName: "text-right",
                className: "text-right font-medium tabular-nums",
                render: (sale) => money(sale.total),
              },
            ]}
          />
        </CardContent>
      </Card>

      <Modal controller={changeModal} title="Sale complete" closable>
        {changeModal.data && (
          <div className="space-y-5">
            <div className="rounded-xl border bg-primary/5 p-5 text-center">
              <p className="text-sm text-muted-foreground">
                {changeModal.data.payment === "cash" ? "Change due" : "Change"}
              </p>
              <p className="mt-1 text-4xl font-bold tabular-nums text-primary">
                {money(changeModal.data.change)}
              </p>
            </div>
            <dl className="space-y-2 rounded-lg border p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Total</dt>
                <dd className="font-medium tabular-nums">{money(changeModal.data.total)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Amount received</dt>
                <dd className="font-medium tabular-nums">{money(changeModal.data.amount)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Payment method</dt>
                <dd className="font-medium capitalize">{changeModal.data.payment}</dd>
              </div>
            </dl>
            <Button className="w-full" onClick={changeModal.closeFn}>
              Done
            </Button>
          </div>
        )}
      </Modal>
      <ConfirmModal
        state={removeCartModal}
        title="Remove item from cart?"
        description={(line) => `Remove ${line?.product.name ?? "this item"} from the current sale?`}
        confirmLabel="Remove item"
        onConfirm={(line) => {
          updateQty(line.product.id, -line.quantity);
          removeCartModal.closeFn();
        }}
      />
      <BarcodeScannerDialog controller={scannerModal} onDetected={handleBarcode} />
    </div>
  );
}
