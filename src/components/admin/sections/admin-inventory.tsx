"use client";

/**
 * OpenStore — Inventory section.
 *
 * Lists products in a table with search + category filter. Actions per row:
 *   - Edit (opens ProductFormDialog prefilled)
 *   - Delete (soft delete -> isActive=false)
 *   - Restock (deep-link to Stock-in tab with this product preselected)
 *
 * "Add product" button opens the same dialog in create mode.
 *
 * Image column shows uploaded image or URL image, falling back to a placeholder.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Trash2, Search, Package, Truck, History, ShoppingCart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import DataTable from "@/components/common/table.component";
import SelectInput from "@/components/common/select.component";
import { useModal } from "@/components/common/modal.component";
import ConfirmModal from "@/components/common/confirm.component";
import { queryKeys } from "@/lib/query-client";
import { DEFAULT_PAGE_SIZE, type PaginationResult } from "@/lib/pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useMoney } from "@/hooks/use-money";
import { CATEGORIES, categoryEmoji, categoryLabel } from "@/lib/constants";
import { toast } from "sonner";
import { SectionHeading } from "@/components/admin/sections/admin-expenses";
import { ProductFormDialog, type ProductFormValue } from "@/components/admin/sections/product-form-dialog";
import {
  PurchaseHistoryDialog,
  type PurchaseHistoryProduct,
} from "@/components/admin/sections/purchase-history-dialog";

type Product = ProductFormValue & {
  id: string;
  isActive: boolean;
  createdAt: string;
};

export function AdminInventory() {
  const { money } = useMoney(); // configured currency
  const router = useRouter();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(1);
  const debouncedQuery = useDebouncedValue(query, 300);
  const productModal = useModal<ProductFormValue>();
  const historyModal = useModal<PurchaseHistoryProduct>();
  const deleteModal = useModal<Product>();

  const { data: products, isLoading } = useQuery<PaginationResult<Product>>({
    queryKey: [
      ...queryKeys.products,
      "inventory",
      page,
      category,
      debouncedQuery,
      showInactive,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        includeInactive: showInactive ? "1" : "0",
        category,
        page: String(page),
        pageSize: String(DEFAULT_PAGE_SIZE),
      });
      if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
      const r = await fetch(`/api/products?${params}`);
      if (!r.ok) throw new Error("Failed to load products");
      return r.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed to delete product");
    },
    onSuccess: () => {
      toast.success("Product removed (set inactive)");
      qc.invalidateQueries({ queryKey: queryKeys.products });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard() });
      deleteModal.closeFn();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreate() {
    productModal.openFn(undefined);
  }
  function openEdit(p: Product) {
    productModal.openFn(p);
  }
  function restock(p: Product) {
    // No query param threading for product preselect (KISS) — user picks in Stock-in.
    router.push("/admin/stock-in");
    toast.info(`Pick "${p.name}" in the product dropdown to record restock.`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeading
          title="Inventory"
          subtitle="Add, edit, and remove products. Prices and stock feed the storefront and POS."
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/restock-list" target="_blank" rel="noopener noreferrer">
              <ShoppingCart className="mr-1 h-4 w-4" /> Grocery list
            </Link>
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> Add product
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name or barcode…"
              className="pl-9"
            />
          </div>
          <SelectInput
            value={category}
            onChange={(value) => {
              setCategory(value);
              setPage(1);
            }}
            className="w-full sm:w-48"
            options={[
              { label: "All categories", value: "all" },
              ...CATEGORIES.map((c) => ({
                label: `${c.emoji} ${c.label}`,
                value: c.value,
              })),
            ]}
          />
          <Button
            variant={showInactive ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setShowInactive((value) => !value);
              setPage(1);
            }}
          >
            {showInactive ? "Showing inactive" : "Hide inactive"}
          </Button>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <DataTable
            data={products?.items ?? []}
            isLoading={isLoading}
            pagination={{
              page,
              pageSize: DEFAULT_PAGE_SIZE,
              total: products?.total ?? 0,
              onPageChange: setPage,
            }}
            emptyState={
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <Package className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">No products found</p>
                <p className="text-xs text-muted-foreground">
                  Add your first product to start tracking sales.
                </p>
                <Button onClick={openCreate} size="sm" className="mt-2">
                  <Plus className="mr-1 h-4 w-4" /> Add product
                </Button>
              </div>
            }
            rowKey={(product) => product.id}
            className="min-w-170"
            containerClassName="max-h-[600px]"
            columns={[
              {
                header: "Image",
                headerClassName: "w-14",
                render: (product) => {
                  const imgSrc = product.imageData ?? product.imageUrl;
                  return (
                    <div className="relative h-10 w-10 overflow-hidden rounded-md border bg-muted">
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={product.name}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-4 w-4 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                  );
                },
              },
              {
                header: "Name",
                render: (product) => (
                  <>
                    <div className="font-medium">{product.name}</div>
                    {product.barcode && (
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {product.barcode}
                      </div>
                    )}
                    {!product.isActive && (
                      <Badge variant="secondary" className="mt-0.5 text-[10px]">
                        Inactive
                      </Badge>
                    )}
                  </>
                ),
              },
              {
                header: "Category",
                render: (product) => (
                  <Badge variant="outline">
                    {categoryEmoji(product.category)} {categoryLabel(product.category)}
                  </Badge>
                ),
              },
              {
                header: "Cost",
                headerClassName: "text-right",
                className: "text-right tabular-nums text-muted-foreground",
                render: (product) => money(product.unitCost),
              },
              {
                header: "Price",
                headerClassName: "text-right",
                className: "text-right tabular-nums font-medium",
                render: (product) => money(product.sellPrice),
              },
              {
                header: "Stock",
                headerClassName: "text-right",
                className: "text-right",
                render: (product) => {
                  const low = product.stock <= product.lowStockThreshold;
                  return (
                    <>
                      <span
                        className={`tabular-nums font-medium ${
                          low ? "text-amber-600 dark:text-amber-400" : ""
                        }`}
                      >
                        {product.stock}
                      </span>
                      {low && (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400">
                          Low
                        </div>
                      )}
                    </>
                  );
                },
              },
              {
                header: "Actions",
                headerClassName: "w-36",
                render: (product) => (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => historyModal.openFn(product)}
                      aria-label="Purchase history"
                      title="Purchase history"
                    >
                      <History className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => restock(product)}
                      aria-label="Restock"
                      title="Restock"
                    >
                      <Truck className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(product)}
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteModal.openFn(product)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>

      <ProductFormDialog controller={productModal} />
      <PurchaseHistoryDialog controller={historyModal} />
      <ConfirmModal
        state={deleteModal}
        title="Remove this product?"
        description={(product) =>
          `${product?.name ?? "This product"} will be set to inactive. It will no longer appear on the storefront or in POS, but historical sales and losses are preserved.`
        }
        confirmLabel="Remove product"
        isLoading={deleteMutation.isPending}
        onConfirm={(product) => deleteMutation.mutate(product.id)}
      />
    </div>
  );
}
