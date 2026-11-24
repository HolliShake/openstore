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
import SelectInput from "@/components/common/select.component";
import { Badge } from "@/components/ui/badge";
import DataTable from "@/components/common/table.component";
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
              <SelectInput
                value={productId}
                onChange={setProductId}
                placeholder="Select product…"
                options={(products ?? [])
                  .filter((p) => p.stock > 0)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((p) => ({
                    label: `${p.name} · stock ${p.stock}`,
                    value: p.id,
                  }))}
              />
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
              <SelectInput
                value={reason}
                onChange={setReason}
                options={LOSS_REASONS.map((r) => ({
                  label: r.label,
                  value: r.value,
                }))}
              />
            </div>
            <div className="space-y-1.5 lg:col-span-3">
              <Label htmlFor="ls-note">Note (optional)</Label>
              <Textarea
                id="ls-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Brief context (e.g. 'wet cardboard', 'past expiry date')"
                className="min-h-10"
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
          <DataTable
            data={losses ?? []}
            isLoading={isLoading}
            emptyState={
              <p className="py-8 text-center text-sm text-muted-foreground">
                No losses recorded yet.
              </p>
            }
            rowKey={(loss) => loss.id}
            className="min-w-170"
            containerClassName="max-h-96 rounded-md"
            columns={[
              {
                header: "When",
                className: "whitespace-nowrap text-xs text-muted-foreground",
                render: (loss) => formatDateTime(loss.createdAt),
              },
              {
                header: "Product",
                className: "font-medium",
                render: (loss) => loss.product.name,
              },
              {
                header: "Qty",
                headerClassName: "text-right",
                className: "text-right tabular-nums",
                render: (loss) => loss.quantity,
              },
              {
                header: "Reason",
                render: (loss) => (
                  <Badge variant="outline">{lossReasonLabel(loss.reason)}</Badge>
                ),
              },
              {
                header: "By",
                className: "text-xs text-muted-foreground",
                render: (loss) =>
                  loss.createdBy ?? <span className="italic opacity-60">unknown</span>,
              },
              {
                header: "Cost value",
                headerClassName: "text-right",
                className: "text-right tabular-nums font-medium text-destructive",
                render: (loss) => money(loss.unitCost * loss.quantity),
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
