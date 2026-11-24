"use client";

/**
 * OpenStore — Store Config Context/Provider.
 *
 * Shares the singleton store branding (name, subtitle, images, welcome text)
 * with every child component via React Context. The provider fetches the
 * config once through TanStack Query and exposes:
 *
 *   - `config`    : the effective config (DB values, with typed nullable images)
 *   - `isLoading` : true while the initial fetch is in flight
 *
 * Consumers render the DB value when present and fall back to built-in
 * defaults (Store icon / gradient hero) when the image fields are null.
 * After an admin saves changes in the Settings section, the query cache is
 * invalidated and every consumer re-renders automatically.
 */
import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";

export type StoreConfig = {
  id: string;
  storeName: string;
  subtitle: string;
  brandImage: string | null;
  bannerImage: string | null;
  welcomeText: string;
  /** ISO 4217 code — see SUPPORTED_CURRENCIES. Default "PHP". */
  currency: string;
  updatedAt: string;
};

/** Fallback used only while the API call is in flight — keeps the first
 *  paint stable and SSR-friendly (default store name is OpenStore). */
export const DEFAULT_CONFIG: StoreConfig = {
  id: "store-config",
  storeName: "OpenStore",
  subtitle: "Neighborhood Store",
  brandImage: null,
  bannerImage: null,
  welcomeText:
    "Browse what's on the shelf today. Prices updated in real time from our inventory system. Drop by the store to pick up your essentials.",
  currency: "PHP",
  updatedAt: new Date(0).toISOString(),
};

type ConfigContextValue = {
  config: StoreConfig;
  isLoading: boolean;
};

const ConfigContext = createContext<ConfigContextValue>({
  config: DEFAULT_CONFIG,
  isLoading: false,
});

export function ConfigProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery<StoreConfig>({
    queryKey: queryKeys.config,
    queryFn: async () => {
      const res = await fetch("/api/config");
      if (!res.ok) throw new Error("Failed to load store config");
      return res.json() as Promise<StoreConfig>;
    },
    staleTime: 60_000,
  });

  return (
    <ConfigContext.Provider
      value={{ config: data ?? DEFAULT_CONFIG, isLoading: isLoading && !data }}
    >
      {children}
    </ConfigContext.Provider>
  );
}

/** Hook: access the shared store config from any client component. */
export function useStoreConfig() {
  return useContext(ConfigContext);
}
