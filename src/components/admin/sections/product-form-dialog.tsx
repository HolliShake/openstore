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
import { Loader2, Upload, Link as LinkIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: ProductFormValue | null;
}) {
  const qc = useQueryClient();
  const { symbol } = useMoney(); // configured currency
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
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit product" : "Add product"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update product details, pricing, and stock."
              : "Fill in the product details. You can save and edit later."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basics */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pf-name">Name *</Label>
              <Input
                id="pf-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Lucky Me Pancit Canton"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.emoji} {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-barcode">Barcode (optional)</Label>
              <Input
                id="pf-barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan or type the product barcode"
              />
            </div>
          </div>

          {/* Pricing + stock */}
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="pf-cost">Avg unit cost ({symbol})</Label>
              <Input
                id="pf-cost"
                type="number"
                min="0"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-[10px] text-muted-foreground">
                Updates automatically (weighted average) when you record restocks.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-price">Sell price ({symbol}) *</Label>
              <Input
                id="pf-price"
                type="number"
                min="0"
                step="0.01"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-stock">Stock</Label>
              <Input
                id="pf-stock"
                type="number"
                min="0"
                step="1"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="0"
                disabled={isEdit}
              />
              {isEdit && (
                <p className="text-[10px] text-muted-foreground">
                  Use Stock-in tab to adjust stock.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-threshold">Low-stock at</Label>
              <Input
                id="pf-threshold"
                type="number"
                min="0"
                step="1"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="5"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="pf-desc">Description (optional)</Label>
            <Textarea
              id="pf-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description customers will see on the storefront"
              className="min-h-[60px]"
            />
          </div>

          {/* Image */}
          <div className="space-y-2">
            <Label>Product image</Label>
            <Tabs value={imageMode} onValueChange={(v) => setImageMode(v as "upload" | "url")}>
              <TabsList>
                <TabsTrigger value="upload" className="text-xs">
                  <Upload className="mr-1 h-3.5 w-3.5" /> Upload
                </TabsTrigger>
                <TabsTrigger value="url" className="text-xs">
                  <LinkIcon className="mr-1 h-3.5 w-3.5" /> URL
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              {imageMode === "upload" ? (
                <div className="space-y-1.5">
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(f);
                    }}
                  />
                  {uploading && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => {
                      setImageUrl(e.target.value);
                      setImageData(null);
                    }}
                    placeholder="https://example.com/product.jpg"
                  />
                </div>
              )}
              {/* Preview */}
              <div className="aspect-square w-full overflow-hidden rounded-md border bg-muted">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Product preview"
                    className="h-full w-full object-cover"
                  />
                ) : imageData ? (
                  <img
                    src={imageData}
                    alt="Product preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                    No image
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
