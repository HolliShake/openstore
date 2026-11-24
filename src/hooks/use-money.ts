"use client";

/**
 * OpenStore — currency-aware money formatting hook.
 *
 * Reads the store's configured currency from the shared Config context and
 * returns stable format functions bound to it. Use this in ANY component that
 * displays money so the whole app follows the admin's currency setting:
 *
 *   const { money, moneyCompact, currency, symbol } = useMoney();
 *   money(1250)          // "₱1,250.00" (or "¥1,250" for JPY, etc.)
 *   moneyCompact(125000) // "₱125.0K"
 */
import { useMemo } from "react";
import { useStoreConfig } from "@/components/providers/config-provider";
import { formatMoney, formatMoneyCompact } from "@/lib/format";
import { DEFAULT_CURRENCY, currencySymbol } from "@/lib/constants";

export function useMoney() {
  const { config } = useStoreConfig();
  const currency = config.currency || DEFAULT_CURRENCY;

  return useMemo(() => {
    const money = (value: number | null | undefined) => formatMoney(value, currency);
    const moneyCompact = (value: number | null | undefined) =>
      formatMoneyCompact(value, currency);
    return { money, moneyCompact, currency, symbol: currencySymbol(currency) };
  }, [currency]);
}
