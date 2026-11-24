"use client";

/**
 * OpenStore — Losses section.
 * Record spoilage / damage / expired / missing stock. Each entry decrements
 * product.stock and captures the unit cost at time of loss (so historical loss
 * totals stay accurate even if product.unitCost changes later).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { LOSS_REASONS, lossReasonLabel } from "@/lib/constants";
import { toast } from "sonner";
import { SectionHeading } from "@/components/admin/sections/admin-expenses";

type Product = {
  id: string;
  name: string;
  category: string;
  stock: number;
  unitCost: number;
};

type Loss = {
  id: string;
  productId: string;
  quantity: number;
  reason: string;
  note: string | null;
  unitCost: number;
  createdBy: string | null;
  createdAt: string;
  product: Product;
};

export function AdminLosses() {
  const { money } = useMoney(); // configured currency
  const qc = useQueryClient();
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState<string>("spoilage");
  const [note, setNote] = useState("");

  const { data: products } = useQuery<Product[]>({
    queryKey: queryKeys.products,
    queryFn: async () => {
      // Active products only — inactive SKUs should not be loss-recordable.
      const r = await fetch("/api/products");
      if (!r.ok) throw new Error("Failed to load products");
      return r.json();
    },
  });

  const { data: losses, isLoading } = useQuery<Loss[]>({
    queryKey: queryKeys.losses,
    queryFn: async () => {
      const r = await fetch("/api/losses");
      if (!r.ok) throw new Error("Failed to load losses");
      return r.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: {
      productId: string;
      quantity: number;
      reason: string;
      note?: string;
    }) => {
      const r = await fetch("/api/losses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error ?? "Failed to record loss");
      }
      return r.json();
    },
    onSuccess: () => {
      toast.success("Loss recorded. Stock decremented.");
      qc.invalidateQueries({ queryKey: queryKeys.losses });
      qc.invalidateQueries({ queryKey: queryKeys.products });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard() });
      setQuantity("");
      setNote("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectedProduct = products?.find((p) => p.id === productId);
  const totalLossValue = (losses ?? []).reduce((s, l) => s + l.unitCost * l.quantity, 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) return toast.error("Pick a product");
    const qty = parseInt(quantity, 10);
    if (!Number.isInteger(qty) || qty <= 0) return toast.error("Quantity must be a positive integer");
    if (selectedProduct && qty > selectedProduct.stock)
      return toast.error(
        `Cannot lose more than current stock (${selectedProduct.stock}) for "${selectedProduct.name}"`,
      );
    createMutation.mutate({
      productId,
      quantity: qty,
      reason,
      note: note.trim() || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Losses"
        subtitle="Record spoilage, damage, expiry, or missing stock. Loss value uses unit cost at the time of loss."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Record a loss</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5 lg:col-span-2">
              <Label>Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product…" />
                </SelectTrigger>
                <SelectContent>
                  {(products ?? [])
                    .filter((p) => p.stock > 0)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} · stock {p.stock}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ls-qty">Quantity lost</Label>
              <Input
                id="ls-qty"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 2"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOSS_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 lg:col-span-3">
              <Label htmlFor="ls-note">Note (optional)</Label>
              <Textarea
                id="ls-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Brief context (e.g. 'wet cardboard', 'past expiry date')"
                className="min-h-[40px]"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full sm:w-auto"
                variant="destructive"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-1 h-4 w-4" />
                )}
                Record loss
              </Button>
            </div>
          </form>
          {selectedProduct && (
            <p className="mt-3 text-xs text-muted-foreground">
              Current: <strong>{selectedProduct.name}</strong> — stock {selectedProduct.stock} ·
              cost {money(selectedProduct.unitCost)} · loss value will be{" "}
              {money(selectedProduct.unitCost * (parseInt(quantity, 10) || 0))}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Loss history</CardTitle>
          <Badge variant="destructive">Total loss value: {money(totalLossValue)}</Badge>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={6} columns={6} />
          ) : (losses?.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No losses recorded yet.
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-md">
              <Table className="min-w-[680px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead className="text-right">Cost value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {losses!.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(l.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium">{l.product.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.quantity}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{lossReasonLabel(l.reason)}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {l.createdBy ?? <span className="italic opacity-60">unknown</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium text-destructive">
                        {money(l.unitCost * l.quantity)}
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
