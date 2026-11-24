"use client";

/**
 * OpenStore — Product form dialog (Create / Edit).
 *
 * Shared by the Inventory section for adding and editing products. Handles:
 *  - All textual fields (name, category, barcode, costs, stock, threshold)
 *  - Image: BOTH upload (file -> /api/upload) and URL paste, toggleable
 *
 * The dialog is controlled — parent opens it with an optional product payload.
 */
import { useEffect, useState } from "react";
import {
  CircleDollarSign,
  ImageIcon,
  Loader2,
  Link as LinkIcon,
  Package,
  Trash2,
  Upload,
} from "lucide-react";
import Modal, { type ModalState } from "@/components/common/modal.component";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import SelectInput from "@/components/common/select.component";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORIES } from "@/lib/constants";
import { useMoney } from "@/hooks/use-money";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";

export type ProductFormValue = {
  id?: string;
  name: string;
  category: string;
  barcode?: string | null;
  unitCost: number;
  sellPrice: number;
  stock: number;
  lowStockThreshold: number;
  imageUrl?: string | null;
  imageData?: string | null;
  description?: string | null;
};

export function ProductFormDialog({
  controller,
}: {
  controller: ModalState<ProductFormValue>;
}) {
  const qc = useQueryClient();
  const { symbol } = useMoney(); // configured currency
  const open = controller.isOpen;
  const initial = controller.data;
  const isEdit = !!initial?.id;

  const [name, setName] = useState("");
  const [category, setCategory] = useState("other");
  const [barcode, setBarcode] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [stock, setStock] = useState("");
  const [threshold, setThreshold] = useState("5");
  const [description, setDescription] = useState("");

  const [imageMode, setImageMode] = useState<"upload" | "url">("upload");
  const [imageUrl, setImageUrl] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync form when dialog opens.
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setCategory(initial.category);
      setBarcode(initial.barcode ?? "");
      setUnitCost(String(initial.unitCost));
      setSellPrice(String(initial.sellPrice));
      setStock(String(initial.stock));
      setThreshold(String(initial.lowStockThreshold));
      setDescription(initial.description ?? "");
      if (initial.imageData) {
        setImageData(initial.imageData);
        setImageMode("upload");
        setImageUrl("");
      } else if (initial.imageUrl) {
        setImageUrl(initial.imageUrl);
        setImageMode("url");
        setImageData(null);
      } else {
        setImageUrl("");
        setImageData(null);
      }
    } else {
      // Reset for create.
      setName("");
      setCategory("other");
      setBarcode("");
      setUnitCost("");
      setSellPrice("");
      setStock("");
      setThreshold("5");
      setDescription("");
      setImageUrl("");
      setImageData(null);
      setImageMode("upload");
    }
  }, [open, initial]);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: form });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error ?? "Upload failed");
      }
      const { url } = await r.json() as { url: string };
      setImageUrl(url); // store as a public path; treat as URL too
      setImageData(null);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required");
    const sp = parseFloat(sellPrice);
    const uc = parseFloat(unitCost || "0");
    const st = parseInt(stock || "0", 10);
    const th = parseInt(threshold || "5", 10);
    if (Number.isNaN(sp) || sp < 0) return toast.error("Sell price must be >= 0");
    if (Number.isNaN(st) || st < 0) return toast.error("Stock must be >= 0");
    if (Number.isNaN(th) || th < 0) return toast.error("Threshold must be >= 0");

    setSaving(true);
    const payload: ProductFormValue = {
      name: name.trim(),
      category,
      barcode: barcode.trim() || null,
      unitCost: Number.isNaN(uc) ? 0 : uc,
      sellPrice: sp,
      stock: st,
      lowStockThreshold: th,
      imageUrl: imageMode === "url" ? imageUrl.trim() || null : null,
      imageData: imageMode === "upload" ? imageData : null,
      description: description.trim() || null,
    };
    // If we uploaded a file, we already have a public path in `imageUrl`.
    if (imageMode === "upload" && imageData == null && imageUrl) {
      payload.imageUrl = imageUrl;
      payload.imageData = null;
    }

    try {
      const url = initial
        ? `/api/products/${initial.id}`
        : "/api/products";
      const method = initial ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error ?? "Failed to save product");
      }
      toast.success(initial ? "Product updated" : "Product created");
      qc.invalidateQueries({ queryKey: queryKeys.products });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard() });
      controller.closeFn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal controller={controller} title={isEdit ? "Edit product" : "Add product"} size="2xl" closable>
      <div className="mb-5 rounded-xl border bg-muted/25 p-4">
        <p className="text-sm font-medium">
          {isEdit ? "Keep your catalog up to date" : "Add a product to your catalog"}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {isEdit
            ? "Update product details and pricing. Record restocks separately to adjust stock."
            : "Add the details your team needs to identify, price, and track this product."}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
        aria-busy={saving || uploading}
      >
        <section aria-labelledby="product-details-heading" className="rounded-xl border p-4 sm:p-5">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Package className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 id="product-details-heading" className="text-sm font-semibold">
                Product details
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Name, category, and optional barcode.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pf-name">Product name <span className="text-destructive">*</span></Label>
              <Input
                id="pf-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Lucky Me Pancit Canton"
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <SelectInput
                value={category}
                onChange={setCategory}
                options={CATEGORIES.map((c) => ({
                  label: `${c.emoji} ${c.label}`,
                  value: c.value,
                }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-barcode">Barcode <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input
                id="pf-barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan or type barcode"
                autoComplete="off"
              />
            </div>
          </div>
        </section>

        <section aria-labelledby="pricing-stock-heading" className="rounded-xl border p-4 sm:p-5">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CircleDollarSign className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 id="pricing-stock-heading" className="text-sm font-semibold">
                Pricing & inventory
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Set selling price and low-stock alerts.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pf-price">Sell price ({symbol}) <span className="text-destructive">*</span></Label>
              <Input
                id="pf-price"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-cost">Average unit cost ({symbol})</Label>
              <Input
                id="pf-cost"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Updated automatically when you record restocks.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-stock">Starting stock</Label>
              <Input
                id="pf-stock"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="0"
                disabled={isEdit}
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                {isEdit ? "Use Stock-in to adjust current stock." : "You can record more stock later."}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-threshold">Low-stock alert at</Label>
              <Input
                id="pf-threshold"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="5"
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Alert when stock reaches this amount.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="product-description-heading" className="rounded-xl border p-4 sm:p-5">
          <div className="mb-3">
            <h2 id="product-description-heading" className="text-sm font-semibold">
              Storefront description
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Optional details customers can see when browsing.
            </p>
          </div>
          <Textarea
            id="pf-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a short product description"
            className="min-h-20"
          />
        </section>

        <section aria-labelledby="product-image-heading" className="rounded-xl border p-4 sm:p-5">
          <div className="mb-3 flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 id="product-image-heading" className="text-sm font-semibold">
                Product image
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Add an image to help identify the product in your catalog.
              </p>
            </div>
          </div>

          <Tabs value={imageMode} onValueChange={(value) => setImageMode(value as "upload" | "url")}>
            <TabsList className="mb-3 grid w-full grid-cols-2 sm:w-fit">
              <TabsTrigger value="upload">
                <Upload className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Upload
              </TabsTrigger>
              <TabsTrigger value="url">
                <LinkIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Image URL
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem] sm:items-start">
            <div className="min-w-0 space-y-2">
              {imageMode === "upload" ? (
                <Input
                  key="image-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  disabled={uploading}
                  aria-label="Upload product image"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                  }}
                />
              ) : (
                <Input
                  key="image-url"
                  id="pf-image-url"
                  type="url"
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    setImageData(null);
                  }}
                  placeholder="https://example.com/product.jpg"
                  aria-label="Product image URL"
                />
              )}
              {uploading && (
                <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading image…
                </p>
              )}
              {(imageUrl || imageData) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-muted-foreground"
                  onClick={() => {
                    setImageUrl("");
                    setImageData(null);
                  }}
                  disabled={uploading}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove image
                </Button>
              )}
            </div>

            <div className="aspect-square w-32 overflow-hidden rounded-lg border bg-muted sm:w-full">
              {imageUrl || imageData ? (
                <img
                  src={imageUrl || imageData || ""}
                  alt="Product preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                  <ImageIcon className="h-6 w-6 opacity-40" aria-hidden="true" />
                  No image yet
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="-mx-6 -mb-6 mt-5 flex flex-col-reverse gap-2 border-t bg-muted/20 px-6 py-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={controller.closeFn}
            disabled={saving}
            className="sm:min-w-24"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving || uploading} className="sm:min-w-36">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : isEdit ? (
              "Save changes"
            ) : (
              "Create product"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
