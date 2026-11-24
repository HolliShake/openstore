"use client";

/**
 * OpenStore — Stock-in section.
 * Record restocks. Each entry increments product.stock and updates product.unitCost
 * to the latest purchase cost (so COGS estimates stay current).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { queryKeys } from "@/lib/query-client";
import { formatDateTime } from "@/lib/format";
import { useMoney } from "@/hooks/use-money";
import { categoryLabel } from "@/lib/constants";
import { toast } from "sonner";
import { SectionHeading } from "@/components/admin/sections/admin-expenses";

type Product = {
  id: string;
  name: string;
  category: string;
  stock: number;
  unitCost: number;
};

/** Weighted-average cost — same formula as the stock-in API. Kept in sync (DRY). */
function computeAvgCost(product: Product, qtyIn: number, costIn: number): number {
  if (product.stock <= 0) return costIn;
  return (product.stock * product.unitCost + qtyIn * costIn) / (product.stock + qtyIn);
}

type StockIn = {
  id: string;
  productId: string;
  quantity: number;
  unitCost: number;
  supplier: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  product: Product;
};

export function AdminStockIn() {
  const { money, symbol } = useMoney(); // configured currency
  const qc = useQueryClient();
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");

  const { data: products } = useQuery<Product[]>({
    queryKey: queryKeys.products,
    queryFn: async () => {
      // Active products only — inactive SKUs should not be restockable.
      const r = await fetch("/api/products");
      if (!r.ok) throw new Error("Failed to load products");
      return r.json();
    },
  });

  const { data: stockIns, isLoading } = useQuery<StockIn[]>({
    queryKey: queryKeys.stockIns,
    queryFn: async () => {
      const r = await fetch("/api/stock-in");
      if (!r.ok) throw new Error("Failed to load stock-ins");
      return r.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: {
      productId: string;
      quantity: number;
      unitCost: number;
      supplier?: string;
      note?: string;
    }) => {
      const r = await fetch("/api/stock-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error ?? "Failed to record stock-in");
      }
      return r.json();
    },
    onSuccess: () => {
      toast.success("Stock-in recorded. Inventory updated.");
      qc.invalidateQueries({ queryKey: queryKeys.stockIns });
      qc.invalidateQueries({ queryKey: queryKeys.products });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard() });
      setQuantity("");
      setUnitCost("");
      setSupplier("");
      setNote("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectedProduct = products?.find((p) => p.id === productId);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) return toast.error("Pick a product");
    const qty = parseInt(quantity, 10);
    const cost = parseFloat(unitCost);
    if (!Number.isInteger(qty) || qty <= 0) return toast.error("Quantity must be a positive integer");
    if (Number.isNaN(cost) || cost < 0) return toast.error("Unit cost must be >= 0");
    createMutation.mutate({
      productId,
      quantity: qty,
      unitCost: cost,
      supplier: supplier.trim() || undefined,
      note: note.trim() || undefined,
    });
  }

  // When product changes, prefill unit cost from current product.unitCost.
  function onSelectChange(id: string) {
    setProductId(id);
    const p = products?.find((x) => x.id === id);
    if (p && !unitCost) setUnitCost(String(p.unitCost));
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Stock-in / Restock"
        subtitle="Record every refill. Stock and unit cost update automatically."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Record restock</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5 lg:col-span-2">
              <Label>Product</Label>
              <Select value={productId} onValueChange={onSelectChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product…" />
                </SelectTrigger>
                <SelectContent>
                  {(products ?? [])
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} · {categoryLabel(p.category)} · stock {p.stock}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="si-qty">Quantity</Label>
              <Input
                id="si-qty"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 12"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="si-cost">Unit cost ({symbol})</Label>
              <Input
                id="si-cost"
                type="number"
                min="0"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="si-sup">Supplier (optional)</Label>
              <Input
                id="si-sup"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="e.g. Puregold"
              />
            </div>
            <div className="space-y-1.5 lg:col-span-3">
              <Label htmlFor="si-note">Note (optional)</Label>
              <Input
                id="si-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Receipt #, batch, etc."
              />
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full sm:w-auto"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-1 h-4 w-4" />
                )}
                Record
              </Button>
            </div>
          </form>
          {selectedProduct && (
            <div className="mt-3 space-y-0.5 text-xs text-muted-foreground">
              <p>
                Current: <strong>{selectedProduct.name}</strong> — stock {selectedProduct.stock} ·
                avg cost {money(selectedProduct.unitCost)} · new stock will be{" "}
                {selectedProduct.stock + (parseInt(quantity, 10) || 0)}
              </p>
              {parseInt(quantity, 10) > 0 && !Number.isNaN(parseFloat(unitCost)) && unitCost !== "" && (
                <p>
                  New average cost:{" "}
                  <strong className="text-foreground">
                    {money(computeAvgCost(selectedProduct, parseInt(quantity, 10), parseFloat(unitCost)))}
                  </strong>{" "}
                  (weighted average — blends this purchase price with your existing stock)
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Restock history</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={6} columns={7} />
          ) : (stockIns?.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No restocks recorded yet.
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-md">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit cost</TableHead>
                    <TableHead className="text-right">Total cost</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockIns!.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(s.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium">{s.product.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(s.unitCost)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {money(s.unitCost * s.quantity)}
                      </TableCell>
                      <TableCell>
                        {s.supplier ? (
                          <Badge variant="outline">{s.supplier}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.createdBy ?? <span className="italic opacity-60">unknown</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
