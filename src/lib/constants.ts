/**
 * OpenStore — Shared constants (single source of truth).
 * Categories, loss reasons, expense categories, payment methods.
 * Kept here so the UI and API never drift apart. (DRY)
 */

export const CATEGORIES = [
  { value: "canned-goods", label: "Canned Goods", emoji: "🥫" },
  { value: "rice", label: "Rice", emoji: "🍚" },
  { value: "fresh-meat", label: "Fresh Meat", emoji: "🥩" },
  { value: "processed-meat", label: "Processed Meat", emoji: "🌭" },
  { value: "biscuits", label: "Biscuits & Snacks", emoji: "🍪" },
  { value: "other", label: "Other", emoji: "📦" },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]["value"];

export const LOSS_REASONS = [
  { value: "spoilage", label: "Spoilage", color: "destructive" },
  { value: "damage", label: "Damaged", color: "destructive" },
  { value: "expired", label: "Expired", color: "warning" },
  { value: "missing", label: "Missing / Unsold", color: "warning" },
  { value: "other", label: "Other", color: "secondary" },
] as const;

export const EXPENSE_CATEGORIES = [
  { value: "utilities", label: "Utilities" },
  { value: "transport", label: "Transport" },
  { value: "rent", label: "Rent" },
  { value: "supplies", label: "Supplies" },
  { value: "other", label: "Other" },
] as const;

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "gcash", label: "GCash" },
  { value: "card", label: "Card" },
] as const;

export function categoryLabel(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? "Other";
}

export function categoryEmoji(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.emoji ?? "📦";
}

export function lossReasonLabel(value: string): string {
  return LOSS_REASONS.find((r) => r.value === value)?.label ?? "Other";
}

export function expenseCategoryLabel(value: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label ?? "Other";
}

/** Product cards visible on the public storefront by default. */
export const FEATURED_CATEGORY_ORDER: readonly string[] = [
  "canned-goods",
  "rice",
  "fresh-meat",
  "processed-meat",
  "biscuits",
  "other",
];

/**
 * Currencies supported by the store Config (single source of truth — the
 * /api/config PUT route validates against this list and the Settings UI
 * renders its dropdown from it). PHP is the default.
 */
export const SUPPORTED_CURRENCIES = [
  { code: "PHP", label: "Philippine Peso", symbol: "₱", country: "Philippines" },
  { code: "USD", label: "US Dollar", symbol: "$", country: "United States" },
  { code: "AUD", label: "Australian Dollar", symbol: "A$", country: "Australia" },
  { code: "CAD", label: "Canadian Dollar", symbol: "CA$", country: "Canada" },
  { code: "CNY", label: "Chinese Yuan", symbol: "CN¥", country: "China" },
  { code: "JPY", label: "Japanese Yen", symbol: "¥", country: "Japan" },
  { code: "KRW", label: "South Korean Won", symbol: "₩", country: "South Korea" },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];

export const DEFAULT_CURRENCY: CurrencyCode = "PHP";

/** Returns true when `code` is one of the supported currency codes. */
export function isSupportedCurrency(code: string): code is CurrencyCode {
  return SUPPORTED_CURRENCIES.some((c) => c.code === code);
}

/** Symbol for a currency code, e.g. "PHP" -> "₱". Falls back to the code. */
export function currencySymbol(code: string): string {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}
