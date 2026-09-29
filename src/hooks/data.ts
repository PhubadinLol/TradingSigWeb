"use client";

import { useApp, withConfig } from "@/components/AppProvider";
import { useApi } from "@/hooks/useApi";
import type { AnalysisResponse, MarketsResponse, MtfResponse, SignalResponse } from "@/lib/apiTypes";
import type { Timeframe } from "@/lib/types";

// Each hook passes a null URL until saved settings are loaded, so we never
// fetch with defaults and then immediately refetch with the user's settings.

export function useSignal(symbol?: string, timeframe?: Timeframe) {
  const app = useApp();
  const s = symbol ?? app.symbol;
  const tf = timeframe ?? app.timeframe;
  return useApi<SignalResponse>(app.ready ? withConfig(`/api/signal/${s}?timeframe=${tf}`, app.configQuery) : null, {
    refreshMs: app.refreshMs,
  });
}

export function useAnalysis(limit = 400) {
  const app = useApp();
  return useApi<AnalysisResponse>(
    app.ready ? withConfig(`/api/analysis/${app.symbol}?timeframe=${app.timeframe}&limit=${limit}`, app.configQuery) : null,
    { refreshMs: app.refreshMs },
  );
}

export function useMtf() {
  const app = useApp();
  return useApi<MtfResponse>(app.ready ? withConfig(`/api/mtf/${app.symbol}`, app.configQuery) : null, { refreshMs: app.refreshMs * 2 });
}

export function useMarkets(all = false) {
  const app = useApp();
  return useApi<MarketsResponse>(
    app.ready ? withConfig(`/api/markets?timeframe=${app.timeframe}${all ? "&all=1" : ""}`, app.configQuery) : null,
    { refreshMs: app.refreshMs },
  );
}
