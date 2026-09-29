"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { DEFAULT_TOGGLES, type ChartToggles } from "@/components/charts/PriceChart";
import { Card, cx, ErrorState, LoadingState } from "@/components/ui";
import type { ApiState } from "@/hooks/useApi";
import type { AnalysisResponse } from "@/lib/apiTypes";
import { formatPct, formatPrice } from "@/lib/format";
import { TIMEFRAME_LABEL } from "@/lib/types";

// The chart library touches `window`, so render it client-side only.
const PriceChart = dynamic(() => import("@/components/charts/PriceChart").then((m) => m.PriceChart), {
  ssr: false,
  loading: () => <LoadingState label="Loading chart…" className="h-[460px]" />,
});

const TOGGLE_KEY = "tsd:chart-toggles:v1";

export function ChartPanel({ state, height = 460 }: { state: ApiState<AnalysisResponse>; height?: number }) {
  const { settings } = useApp();
  const [toggles, setToggles] = useState<ChartToggles>(DEFAULT_TOGGLES);
  const { data, error, reload } = state;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TOGGLE_KEY);
      if (raw) setToggles({ ...DEFAULT_TOGGLES, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = (k: keyof ChartToggles) =>
    setToggles((t) => {
      const next = { ...t, [k]: !t[k] };
      try {
        localStorage.setItem(TOGGLE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });

  const periods = data?.periods ?? { emaFast: 20, emaMid: 50, emaSlow: 200 };
  const items: { k: keyof ChartToggles; label: string; color?: string }[] = [
    { k: "emaFast", label: `EMA ${periods.emaFast}`, color: "var(--ema-fast)" },
    { k: "emaMid", label: `EMA ${periods.emaMid}`, color: "var(--ema-mid)" },
    { k: "emaSlow", label: `EMA ${periods.emaSlow}`, color: "var(--ema-slow)" },
    { k: "bollinger", label: "Bollinger", color: "var(--muted)" },
    { k: "levels", label: "S/R levels" },
    { k: "markers", label: "Signals" },
    { k: "volume", label: "Volume" },
  ];

  const last = data?.candles[data.candles.length - 1];
  const prev = data?.candles[data.candles.length - 2];
  const change = last && prev ? ((last.close - prev.close) / prev.close) * 100 : null;

  return (
    <Card
      title={
        data ? (
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span>{data.display} · {TIMEFRAME_LABEL[data.timeframe]}</span>
            <span className="num text-base">{formatPrice(last?.close, data.precision)}</span>
            <span className={cx("num text-xs", (change ?? 0) >= 0 ? "text-up" : "text-down")}>{formatPct(change, 2, true)}</span>
          </span>
        ) : (
          "Chart"
        )
      }
      subtitle={data?.formingBar ? "Last candle is still forming; signals use closed candles only. Scroll to pan, wheel/pinch to zoom." : "Scroll to pan, wheel/pinch to zoom."}
      bodyClassName="p-0"
    >
      <div className="flex flex-wrap gap-1.5 border-b border-border px-4 py-2" role="group" aria-label="Chart overlays">
        {items.map((it) => (
          <button
            key={it.k}
            aria-pressed={toggles[it.k]}
            onClick={() => toggle(it.k)}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
              toggles[it.k] ? "border-border bg-panel-2 text-fg" : "border-transparent text-muted hover:text-fg",
            )}
          >
            {it.color && <span className="h-0.5 w-3 rounded" style={{ background: it.color }} aria-hidden />}
            {it.label}
          </button>
        ))}
      </div>
      <div className="p-2">
        {error && !data ? (
          <ErrorState message={error} onRetry={reload} className="m-2" />
        ) : !data ? (
          <LoadingState label="Loading market data…" className="" />
        ) : (
          <PriceChart data={data} toggles={toggles} theme={settings.theme} timezone={settings.timezone} height={height} />
        )}
      </div>
    </Card>
  );
}
