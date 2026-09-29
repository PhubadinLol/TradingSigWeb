"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useApi } from "@/hooks/useApi";
import type { StatusResponse } from "@/lib/apiTypes";
import { DEFAULT_SETTINGS, overridesToQuery, type UserSettings } from "@/lib/settingsSchema";
import type { Timeframe } from "@/lib/types";

const SETTINGS_KEY = "tsd:settings:v1";
const VIEW_KEY = "tsd:view:v1";

interface AppContextValue {
  /** False until persisted settings have been read; data hooks wait for it. */
  ready: boolean;
  symbol: string;
  timeframe: Timeframe;
  setSymbol: (s: string) => void;
  setTimeframe: (tf: Timeframe) => void;
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings> | ((s: UserSettings) => UserSettings)) => void;
  resetSettings: () => void;
  /** Query string with the user's engine overrides, e.g. "rsiPeriod=21". */
  configQuery: string;
  status: StatusResponse | null;
  statusError: string | null;
  refreshMs: number;
}

const AppContext = createContext<AppContextValue | null>(null);

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode) — settings just won't persist */
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [symbol, setSymbolState] = useState("BTCUSDT");
  const [timeframe, setTimeframeState] = useState<Timeframe>("1h");
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted state after mount (avoids SSR hydration mismatches).
  useEffect(() => {
    const s = readJson<Partial<UserSettings>>(SETTINGS_KEY);
    if (s) {
      setSettings({
        ...DEFAULT_SETTINGS,
        ...s,
        risk: { ...DEFAULT_SETTINGS.risk, ...s.risk },
        alerts: { ...DEFAULT_SETTINGS.alerts, ...s.alerts },
        overrides: s.overrides ?? {},
      });
    }
    const v = readJson<{ symbol?: string; timeframe?: Timeframe }>(VIEW_KEY);
    if (v?.symbol) setSymbolState(v.symbol);
    if (v?.timeframe) setTimeframeState(v.timeframe);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) writeJson(SETTINGS_KEY, settings);
  }, [settings, hydrated]);

  useEffect(() => {
    if (hydrated) writeJson(VIEW_KEY, { symbol, timeframe });
  }, [symbol, timeframe, hydrated]);

  // Apply theme.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
    try {
      localStorage.setItem("tsd:theme", settings.theme);
    } catch {
      /* ignore */
    }
  }, [settings.theme]);

  const status = useApi<StatusResponse>("/api/status", { refreshMs: 60_000 });

  const updateSettings = useCallback<AppContextValue["updateSettings"]>((patch) => {
    setSettings((prev) => (typeof patch === "function" ? patch(prev) : { ...prev, ...patch }));
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      ready: hydrated,
      symbol,
      timeframe,
      setSymbol: setSymbolState,
      setTimeframe: setTimeframeState,
      settings,
      updateSettings,
      resetSettings: () => setSettings(DEFAULT_SETTINGS),
      configQuery: overridesToQuery(settings.overrides),
      status: status.data,
      statusError: status.error,
      refreshMs: Math.max(15, settings.refreshSeconds) * 1000,
    }),
    [hydrated, symbol, timeframe, settings, updateSettings, status.data, status.error],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}

/** Append the user's engine overrides to an API path. */
export function withConfig(path: string, configQuery: string): string {
  if (!configQuery) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${configQuery}`;
}
