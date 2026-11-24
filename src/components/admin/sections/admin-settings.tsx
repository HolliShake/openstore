"use client";

/**
 * OpenStore — Store Settings section (ADMIN ONLY).
 *
 * Edit the store branding stored in the singleton Config row:
 *   - store name   (default "OpenStore")
 *   - subtitle     (small line under the name)
 *   - brand image  (logo shown in header/footer; null = built-in Store icon)
 *   - banner image (storefront hero background; null = built-in gradient)
 *   - welcome text (tagline shown on the hero)
 *
 * Images can be pasted as a URL (http/https or /uploads path) or uploaded
 * directly (stored via /api/upload). Saving PUTs to /api/config and
 * invalidates the shared config query so every surface (storefront header,
 * hero, footer, admin topbar) updates instantly through the Config context.
 */
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Store, ImageIcon, Loader2, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryKeys } from "@/lib/query-client";
import { SUPPORTED_CURRENCIES, isSupportedCurrency } from "@/lib/constants";
import { useStoreConfig } from "@/components/providers/config-provider";
import { SectionHeading } from "@/components/admin/sections/admin-expenses";

type ConfigPayload = {
  storeName?: string;
  subtitle?: string;
  brandImage?: string | null;
  bannerImage?: string | null;
  welcomeText?: string;
  currency?: string;
};

export function AdminSettings() {
  const { config, isLoading } = useStoreConfig();
  const queryClient = useQueryClient();

  // Form state — one object keeps the render-time sync below simple.
  const [form, setForm] = useState({
    storeName: config.storeName,
    subtitle: config.subtitle,
    welcomeText: config.welcomeText,
    brandImage: config.brandImage ?? "",
    bannerImage: config.bannerImage ?? "",
    currency: isSupportedCurrency(config.currency) ? config.currency : "PHP",
  });
  const [syncedAt, setSyncedAt] = useState(config.updatedAt);

  // Adjust form state during render when a fresh config arrives (initial
  // load or after save). This is React's recommended pattern for "reset
  // state when a prop changes" — no cascading effect renders.
  if (config.updatedAt !== syncedAt) {
    setSyncedAt(config.updatedAt);
    setForm({
      storeName: config.storeName,
      subtitle: config.subtitle,
      welcomeText: config.welcomeText,
      brandImage: config.brandImage ?? "",
      bannerImage: config.bannerImage ?? "",
      currency: isSupportedCurrency(config.currency) ? config.currency : "PHP",
    });
  }

  const save = useMutation({
    mutationFn: async (payload: ConfigPayload) => {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save settings");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.config });
      toast.success("Store settings saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSave() {
    if (!form.storeName.trim()) {
      toast.error("Store name cannot be empty");
      return;
    }
    save.mutate({
      storeName: form.storeName.trim(),
      subtitle: form.subtitle.trim(),
      welcomeText: form.welcomeText.trim(),
      // Empty string means "clear" — sent as null so the UI falls back to defaults.
      brandImage: form.brandImage.trim() || null,
      bannerImage: form.bannerImage.trim() || null,
      currency: form.currency,
    });
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Store Settings"
        subtitle="Branding shown on the public storefront and across the admin dashboard."
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Store className="h-4 w-4" /> Store identity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="storeName">Store name</Label>
                  <Input
                    id="storeName"
                    value={form.storeName}
                    onChange={(e) => setForm((f) => ({ ...f, storeName: e.target.value }))}
                    placeholder="OpenStore"
                    maxLength={60}
                  />
                  <p className="text-xs text-muted-foreground">
                    Shown in the header, hero, footer and browser tab. Default: OpenStore.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subtitle">Subtitle</Label>
                  <Input
                    id="subtitle"
                    value={form.subtitle}
                    onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                    placeholder="Neighborhood Store"
                    maxLength={120}
                  />
                  <p className="text-xs text-muted-foreground">
                    Small line under the store name. Leave empty to hide it.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="welcomeText">Welcome text / tagline</Label>
                <Textarea
                  id="welcomeText"
                  value={form.welcomeText}
                  onChange={(e) => setForm((f) => ({ ...f, welcomeText: e.target.value }))}
                  placeholder="Welcome to our store…"
                  rows={3}
                  maxLength={400}
                />
                <p className="text-xs text-muted-foreground">
                  Displayed on the storefront hero under the store name.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={form.currency}
                  onValueChange={(value) =>
                    setForm((f) => ({ ...f, currency: value as (typeof SUPPORTED_CURRENCIES)[number]["code"] }))
                  }
                >
                  <SelectTrigger id="currency" className="w-full sm:w-72">
                    <SelectValue placeholder="Select a currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.symbol} {c.code} — {c.label} ({c.country})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Used for every price, sale, expense and report across the app.
                  Default: PHP (Philippine Peso).
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ImageIcon className="h-4 w-4" /> Images
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <ImageField
                label="Brand image (logo)"
                help="Shown in the header & footer. Leave empty to use the default store icon."
                value={form.brandImage}
                onChange={(v) => setForm((f) => ({ ...f, brandImage: v }))}
                previewClassName="h-16 w-16 rounded-lg object-cover"
              />
              <ImageField
                label="Banner image"
                help="Background of the storefront hero. Leave empty to use the default gradient."
                value={form.bannerImage}
                onChange={(v) => setForm((f) => ({ ...f, bannerImage: v }))}
                previewClassName="h-16 w-full rounded-lg object-cover"
              />
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={save.isPending}>
              {save.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save settings
            </Button>
            <p className="text-xs text-muted-foreground">
              Changes appear on the storefront immediately after saving.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/** URL input + file upload + preview + "use default" clear for one image field. */
function ImageField({
  label,
  help,
  value,
  onChange,
  previewClassName,
}: {
  label: string;
  help: string;
  value: string;
  onChange: (value: string) => void;
  previewClassName: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Upload failed");
      onChange(body.url as string);
      toast.success(`${label} uploaded`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste an image URL, or upload a file"
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          aria-label={`Upload ${label}`}
          title="Upload image"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
        </Button>
        {value ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onChange("")}
            aria-label={`Clear ${label}`}
            title="Reset to default"
          >
            <XCircle className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      {/* Preview — shows the default fallback hint when empty */}
      <div className="flex min-h-16 items-center gap-3 rounded-lg border border-dashed border-border/70 p-2">
        {value ? (
          <img src={value} alt={`${label} preview`} className={previewClassName} />
        ) : (
          <p className="text-xs text-muted-foreground">
            Using the built-in default (nothing set).
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{help}</p>
    </div>
  );
}
