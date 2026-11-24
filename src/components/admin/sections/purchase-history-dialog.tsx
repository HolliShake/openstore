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
import { Badge } from "@/components/ui/badge";
import DataTable from "@/components/common/table.component";
import Modal, { type ModalState } from "@/components/common/modal.component";
import { queryKeys } from "@/lib/query-client";
import { formatDateTime } from "@/lib/format";
import { useMoney } from "@/hooks/use-money";

export type PurchaseHistoryProduct = {
  id: string;
  name: string;
  stock: number;
  unitCost: number;
};

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
  controller,
}: {
  controller: ModalState<PurchaseHistoryProduct>;
}) {
  const { money } = useMoney(); // configured currency
  const open = controller.isOpen;
  const product = controller.data;
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
    <Modal controller={controller} title="Purchase history" size="lg" closable>
      <p className="mb-4 text-sm text-muted-foreground">
        {product ? product.name : ""} — every restock batch, price, and supplier.
      </p>
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

        <DataTable
          data={rows}
          isLoading={isLoading}
          emptyState={
            <p className="py-8 text-center text-sm text-muted-foreground">
              No restocks recorded for this product yet. The current stock came from the
              initial product setup.
            </p>
          }
          rowKey={(row) => row.id}
          containerClassName="max-h-72 rounded-md border"
          columns={[
            {
              header: "When",
              className: "whitespace-nowrap text-xs text-muted-foreground",
              render: (row) => formatDateTime(row.createdAt),
            },
            {
              header: "Supplier",
              render: (row) =>
                row.supplier ? (
                  <Badge variant="outline" className="text-[10px]">
                    {row.supplier}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                ),
            },
            {
              header: "Qty",
              headerClassName: "text-right",
              className: "text-right tabular-nums",
              render: (row) => row.quantity,
            },
            {
              header: "Price/unit",
              headerClassName: "text-right",
              className: "text-right tabular-nums",
              render: (row) => money(row.unitCost),
            },
            {
              header: "Total",
              headerClassName: "text-right",
              className: "text-right tabular-nums font-medium",
              render: (row) => money(row.unitCost * row.quantity),
            },
          ]}
        />

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          The <strong className="text-foreground">avg cost / unit</strong> above is a weighted
          average: each purchase price is blended into your effective cost based on the
          quantities you already had. Sales and losses use this average, so profit stays
          accurate even when prices differ between stores.
        </p>
    </Modal>
  );
}
