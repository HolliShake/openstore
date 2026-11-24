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
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Plus, Pencil, Trash2, Search, Package, Truck, History, ShoppingCart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { queryKeys } from "@/lib/query-client";
import { useMoney } from "@/hooks/use-money";
import { CATEGORIES, categoryEmoji, categoryLabel } from "@/lib/constants";
import { toast } from "sonner";
import { SectionHeading } from "@/components/admin/sections/admin-expenses";
import { ProductFormDialog, type ProductFormValue } from "@/components/admin/sections/product-form-dialog";
import { PurchaseHistoryDialog } from "@/components/admin/sections/purchase-history-dialog";

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: [queryKeys.products, showInactive ? "with-inactive" : "active-only"],
    queryFn: async () => {
      const r = await fetch(
        `/api/products?includeInactive=${showInactive ? "1" : "0"}`,
      );
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
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visible = useMemo(() => {
    if (!products) return [];
    return products.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !(p.barcode ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [products, query, category]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(p: Product) {
    setEditing(p);
    setDialogOpen(true);
  }
  function restock(p: Product) {
    // No query param threading for product preselect (KISS) — user picks in Stock-in.
    router.push("/admin?tab=stock-in");
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
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or barcode…"
              className="pl-9"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.emoji} {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={showInactive ? "default" : "outline"}
            size="sm"
            onClick={() => setShowInactive((v) => !v)}
          >
            {showInactive ? "Showing inactive" : "Hide inactive"}
          </Button>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton rows={6} columns={7} />
          ) : visible.length === 0 ? (
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
          ) : (
            <div className="max-h-[600px] overflow-auto">
              <Table className="min-w-[680px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Image</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="w-36">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((p) => {
                    const imgSrc = p.imageData ?? p.imageUrl;
                    const low = p.stock <= p.lowStockThreshold;
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="relative h-10 w-10 overflow-hidden rounded-md border bg-muted">
                            {imgSrc ? (
                              <Image
                                src={imgSrc}
                                alt={p.name}
                                fill
                                sizes="40px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Package className="h-4 w-4 text-muted-foreground/40" />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{p.name}</div>
                          {p.barcode && (
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {p.barcode}
                            </div>
                          )}
                          {!p.isActive && (
                            <Badge variant="secondary" className="mt-0.5 text-[10px]">
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {categoryEmoji(p.category)} {categoryLabel(p.category)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {money(p.unitCost)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {money(p.sellPrice)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`tabular-nums font-medium ${
                              low ? "text-amber-600 dark:text-amber-400" : ""
                            }`}
                          >
                            {p.stock}
                          </span>
                          {low && (
                            <div className="text-[10px] text-amber-600 dark:text-amber-400">
                              Low
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setHistoryProduct(p)}
                              aria-label="Purchase history"
                              title="Purchase history"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => restock(p)}
                              aria-label="Restock"
                              title="Restock"
                            >
                              <Truck className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(p)}
                              aria-label="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(p.id)}
                              aria-label="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
      />

      <PurchaseHistoryDialog
        open={!!historyProduct}
        onOpenChange={(v) => !v && setHistoryProduct(null)}
        product={historyProduct}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this product?</AlertDialogTitle>
            <AlertDialogDescription>
              The product will be set to inactive. It will no longer appear on the
              storefront or in POS, but historical sales and losses are preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove product
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
