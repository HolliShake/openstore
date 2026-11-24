/**
 * OpenStore — Store configuration API (singleton "Config" row).
 *
 * GET  /api/config   (PUBLIC: storefront + admin read branding)
 * PUT  /api/config   (ADMIN ONLY: update branding)
 *
 * PUT body (all fields optional, validated):
 *   - storeName   (1–60 chars, required non-empty)
 *   - subtitle    (0–120 chars)
 *   - brandImage  (null or URL/data-URL string — null restores default icon)
 *   - bannerImage (null or URL/data-URL string — null restores default gradient)
 *   - welcomeText (0–400 chars tagline)
 *   - currency    (ISO 4217 code from SUPPORTED_CURRENCIES — PHP, USD, AUD,
 *                  CAD, CNY, JPY, KRW)
 *
 * The GET route never 404s: if the config row is missing (fresh DB) it is
 * created on first read with the schema defaults, and the response always
 * contains every field so the client can rely on the shape.
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, badRequest, serverError, withAdmin, readJson } from "@/lib/api";
import { isSupportedCurrency } from "@/lib/constants";

const CONFIG_ID = "store-config";

const MAX_LENGTHS = {
  storeName: 60,
  subtitle: 120,
  welcomeText: 400,
  brandImage: 1_000_000, // data URLs can be large (uploaded images)
  bannerImage: 1_000_000,
} as const;

/** Allowed image sources: absolute http(s) URLs, root-relative upload
 *  paths (e.g. "/uploads/x.png" from the /api/upload route), or inline
 *  data:image URLs. */
function isValidImage(value: string): boolean {
  if (/^https?:\/\//i.test(value)) return true;
  if (/^\/[^\s]*$/i.test(value)) return true; // e.g. /uploads/logo.png
  return /^data:image\/(png|jpe?g|gif|webp|svg\+xml|avif);base64,/i.test(value);
}

/** Fetch the singleton row, creating it with defaults on first access. */
async function getOrCreateConfig() {
  return db.config.upsert({
    where: { id: CONFIG_ID },
    update: {},
    create: { id: CONFIG_ID },
  });
}

export async function GET() {
  try {
    const config = await getOrCreateConfig();
    return ok(config);
  } catch (e) {
    return serverError("Failed to fetch store config", e);
  }
}

export const PUT = withAdmin(async (req: NextRequest) => {
  const { data, error } = await readJson<{
    storeName?: string;
    subtitle?: string;
    brandImage?: string | null;
    bannerImage?: string | null;
    welcomeText?: string;
    currency?: string;
  }>(req);
  if (error) return badRequest(error);
  if (!data) return badRequest("Missing body");

  const update: {
    storeName?: string;
    subtitle?: string;
    brandImage?: string | null;
    bannerImage?: string | null;
    welcomeText?: string;
    currency?: string;
  } = {};

  if (data.storeName !== undefined) {
    const storeName = String(data.storeName).trim();
    if (!storeName) return badRequest("Store name cannot be empty");
    if (storeName.length > MAX_LENGTHS.storeName)
      return badRequest(`Store name must be at most ${MAX_LENGTHS.storeName} characters`);
    update.storeName = storeName;
  }

  for (const field of ["subtitle", "welcomeText"] as const) {
    const value = data[field];
    if (value !== undefined) {
      const trimmed = String(value).trim();
      if (trimmed.length > MAX_LENGTHS[field])
        return badRequest(
          `${field === "subtitle" ? "Subtitle" : "Welcome text"} must be at most ${MAX_LENGTHS[field]} characters`,
        );
      update[field] = trimmed;
    }
  }

  for (const field of ["brandImage", "bannerImage"] as const) {
    const value = data[field];
    if (value === undefined) continue;
    if (value === null || value === "") {
      update[field] = null; // explicit reset to the built-in default
      continue;
    }
    const trimmed = String(value).trim();
    if (!isValidImage(trimmed))
      return badRequest(
        `${field === "brandImage" ? "Brand image" : "Banner image"} must be an image URL or an uploaded image`,
      );
    if (trimmed.length > MAX_LENGTHS[field])
      return badRequest("Image is too large — please upload a smaller file");
    update[field] = trimmed;
  }

  if (data.currency !== undefined) {
    const currency = String(data.currency).trim().toUpperCase();
    if (!isSupportedCurrency(currency))
      return badRequest(
        "Unsupported currency. Choose one of: PHP, USD, AUD, CAD, CNY, JPY, KRW",
      );
    update.currency = currency;
  }

  if (Object.keys(update).length === 0)
    return badRequest("Nothing to update — provide at least one field");

  try {
    const config = await db.$transaction(async (tx) => {
      await tx.config.upsert({
        where: { id: CONFIG_ID },
        update: {},
        create: { id: CONFIG_ID },
      });
      return tx.config.update({
        where: { id: CONFIG_ID },
        data: update,
      });
    });
    return ok(config);
  } catch (e) {
    return serverError("Failed to update store config", e);
  }
});
