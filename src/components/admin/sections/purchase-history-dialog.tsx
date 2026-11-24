"use client";

/**
 * OpenStore — Purchase history dialog.
 *
 * Opens from an Inventory row and shows every StockIn (restock) recorded for
 * that product: date, supplier, quantity, purchase price, and total. This is
 * the direct answer to "what if I bought at different stores and different
 * prices?" — every batch is listed, and the blended weighted-average cost is
 * shown at the top.
 */
import { useQuery } from "@tanstack/react-query";
import { History, Store as StoreIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

type StockInRow = {
  id: string;
  productId: string;
  quantity: number;
  unitCost: number;
  supplier: string | null;
  note: string | null;
  createdAt: string;
};

export function PurchaseHistoryDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: {
    id: string;
    name: string;
    stock: number;
    unitCost: number;
  } | null;
}) {
  const { money } = useMoney(); // configured currency
  const { data: stockIns, isLoading } = useQuery<StockInRow[]>({
    queryKey: queryKeys.stockIns,
    queryFn: async () => {
      const r = await fetch("/api/stock-in");
      if (!r.ok) throw new Error("Failed to load purchase history");
      return r.json();
    },
    enabled: open && !!product,
  });

  const rows = (stockIns ?? [])
    .filter((s) => s.productId === product?.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const distinctSuppliers = Array.from(
    new Set(rows.map((r) => r.supplier).filter(Boolean)),
  ) as string[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Purchase history
          </DialogTitle>
          <DialogDescription>
            {product ? product.name : ""} — every restock batch, price, and supplier.
          </DialogDescription>
        </DialogHeader>

        {product && (
          <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-center">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Current stock
              </div>
              <div className="mt-0.5 text-lg font-bold tabular-nums">{product.stock}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Avg cost / unit
              </div>
              <div className="mt-0.5 text-lg font-bold tabular-nums text-primary">
                {money(product.unitCost)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Stock value
              </div>
              <div className="mt-0.5 text-lg font-bold tabular-nums">
                {money(product.stock * product.unitCost)}
              </div>
            </div>
          </div>
        )}

        {distinctSuppliers.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <StoreIcon className="h-3.5 w-3.5" /> Suppliers:
            {distinctSuppliers.map((s) => (
              <Badge key={s} variant="outline" className="text-[10px]">
                {s}
              </Badge>
            ))}
          </div>
        )}

        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No restocks recorded for this product yet. The current stock came from the
            initial product setup.
          </p>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price/unit</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(r.createdAt)}
                    </TableCell>
                    <TableCell>
                      {r.supplier ? (
                        <Badge variant="outline" className="text-[10px]">
                          {r.supplier}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(r.unitCost)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {money(r.unitCost * r.quantity)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          The <strong className="text-foreground">avg cost / unit</strong> above is a weighted
          average: each purchase price is blended into your effective cost based on the
          quantities you already had. Sales and losses use this average, so profit stays
          accurate even when prices differ between stores.
        </p>
      </DialogContent>
    </Dialog>
  );
}
