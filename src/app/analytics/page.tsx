"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { BacktestResults } from "@/components/BacktestResults";
import { Badge, Card, cx, EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui";
import { apiFetch } from "@/hooks/useApi";
import type { BacktestResponse } from "@/lib/apiTypes";
import { FEATURED_SYMBOLS } from "@/lib/symbols";
import { TIMEFRAMES, TIMEFRAME_LABEL, type Timeframe } from "@/lib/types";

export default function AnalyticsPage() {
  const app = useApp();
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [data, setData] = useState<BacktestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const overrides = JSON.stringify(app.settings.overrides);

  useEffect(() => {
    if (!app.ready) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<BacktestResponse>("/api/backtest", {
      method: "POST",
      body: JSON.stringify({ symbols: FEATURED_SYMBOLS.map((s) => s.id), timeframe, bars: 1000, overrides: JSON.parse(overrides) }),
    })
      .then((r) => !cancelled && setData(r))
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [app.ready, timeframe, overrides, tick]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance analytics"
        description="How the engine's signals would have performed historically across the featured markets."
        action={
          <div role="group" aria-label="Timeframe" className="flex rounded-md border border-border bg-panel-2 p-0.5">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                aria-pressed={tf === timeframe}
                onClick={() => setTimeframe(tf)}
                className={cx("num rounded px-2 py-1 text-xs", tf === timeframe ? "bg-panel text-fg shadow-sm" : "text-muted hover:text-fg")}
              >
                {TIMEFRAME_LABEL[tf]}
              </button>
            ))}
          </div>
        }
      />

      <section aria-labelledby="bt-heading" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="bt-heading" className="text-base font-semibold">Historical backtest results</h2>
          <Badge tone="accent">Simulated</Badge>
          {data && !data.meta.isLive && <Badge tone="warn">Demo data — illustrative only</Badge>}
        </div>
        <p className="text-xs text-muted">
          Walk-forward replay of the engine on the last ~1000 {TIMEFRAME_LABEL[timeframe]} candles of {FEATURED_SYMBOLS.map((s) => s.display).join(", ")}. Target = take profit 1, one position per market, no fees or slippage. These are hypothetical results — not live trading.
        </p>
        {error && !data ? (
          <ErrorState message={error} onRetry={() => setTick((t) => t + 1)} />
        ) : !data ? (
          <LoadingState label="Running historical backtest…" />
        ) : (
          <div className={cx(loading && "opacity-60")}>
            <BacktestResults data={data} />
          </div>
        )}
      </section>

      <section aria-labelledby="live-heading" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="live-heading" className="text-base font-semibold">Live performance</h2>
          <Badge>Not tracked</Badge>
        </div>
        <Card>
          <EmptyState title="No live performance recorded">
            {app.status?.meta.isLive
              ? "Live signals are shown on the dashboard, but forward performance is not recorded yet. Tracking live results needs persistent storage (e.g. a database) so each signal can be logged when issued and resolved later."
              : "The app is running on demo data, so there is no live performance to report. Connect a market data provider and add persistent storage to track signals forward in time."}{" "}
            Figures above are backtests only and must not be read as live results.
          </EmptyState>
        </Card>
      </section>
    </div>
  );
}
