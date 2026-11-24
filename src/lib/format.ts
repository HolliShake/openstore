/**
 * OpenStore — currency / date formatting helpers.
 * Money is formatted with the store's configured currency (see Config +
 * SUPPORTED_CURRENCIES in src/lib/constants.ts). Default: PHP (₱).
 */
import {
  DEFAULT_CURRENCY,
  currencySymbol,
  type CurrencyCode,
} from "@/lib/constants";

/** Intl formatters are expensive — cache one per currency code. */
const formatterCache = new Map<string, Intl.NumberFormat>();

function currencyFormatter(code: string): Intl.NumberFormat {
  const key = code || DEFAULT_CURRENCY;
  let fmt = formatterCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: key });
    formatterCache.set(key, fmt);
  }
  return fmt;
}

/** Format a number with the store's configured currency.
 *  e.g. (1250, "PHP") -> "₱1,250.00", (1250, "JPY") -> "¥1,250".
 *  Zero-decimal currencies (JPY, KRW) automatically show no cents. */
export function formatMoney(
  value: number | null | undefined,
  currency: string = DEFAULT_CURRENCY,
): string {
  const symbol = currencySymbol(currency);
  if (value === null || value === undefined || Number.isNaN(value))
    return currencyFormatter(currency).format(0);
  try {
    return currencyFormatter(currency).format(value);
  } catch {
    return `${symbol}${value}`; // unknown code — fall back to symbol + raw number
  }
}

/** Compact money for stat cards. e.g. (125000, "PHP") -> "₱125.0K". */
export function formatMoneyCompact(
  value: number | null | undefined,
  currency: string = DEFAULT_CURRENCY,
): string {
  const symbol = currencySymbol(currency);
  const v = value ?? 0;
  if (Math.abs(v) >= 1_000_000) return `${symbol}${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${symbol}${(v / 1_000).toFixed(1)}K`;
  return formatMoney(v, currency);
}

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US");

/** @deprecated Use formatMoney(value, currency) — kept for the PHP default
 *  while call sites migrate to the configurable currency. */
export function formatPHP(value: number | null | undefined): string {
  return formatMoney(value, "PHP");
}

/** @deprecated Use formatMoneyCompact(value, currency). */
export function formatPHPCompact(value: number): string {
  return formatMoneyCompact(value, "PHP");
}

export function formatNumber(value: number): string {
  return NUMBER_FORMATTER.format(value);
}

export type { CurrencyCode };

/** "Nov 24, 2026" style date. */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** "Nov 24, 2026, 3:45 PM" */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Monday-based ISO week label, e.g. "Week of Nov 23, 2026". */
export function weekLabel(date: Date | string = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // back to Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return `Week of ${monday.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

/** Returns [Monday 00:00, next Monday 00:00) for the week containing the given date. */
export function weekRange(date: Date | string = new Date()): [Date, Date] {
  const d = typeof date === "string" ? new Date(date) : new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(d.getDate() + diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return [start, end];
}

/** Returns start & end of the week N weeks ago (0 = current week). */
export function weekRangeOffset(offsetWeeks: number = 0): [Date, Date] {
  return weekRange(new Date(Date.now() - offsetWeeks * 7 * 24 * 60 * 60 * 1000));
}
