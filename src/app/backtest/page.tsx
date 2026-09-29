"use client";

import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { BacktestResults } from "@/components/BacktestResults";
import { Badge, Button, Card, cx, EmptyState, ErrorState, Field, inputClass, LoadingState, PageHeader } from "@/components/ui";
import { apiFetch } from "@/hooks/useApi";
import type { BacktestResponse } from "@/lib/apiTypes";
import { FEATURED_SYMBOLS, SYMBOLS } from "@/lib/symbols";
import { TIMEFRAMES, TIMEFRAME_LABEL, type Timeframe } from "@/lib/types";

export default function BacktestPage() {
  const app = useApp();
  const [symbols, setSymbols] = useState<string[]>([app.symbol]);
  const [timeframe, setTimeframe] = useState<Timeframe>(app.timeframe);
  const [bars, setBars] = useState(1000);
  const [target, setTarget] = useState<"tp1" | "tp2">("tp1");
  const [minStrength, setMinStrength] = useState<"normal" | "strong">("normal");
  const [maxBars, setMaxBars] = useState(48);
  const [result, setResult] = useState<BacktestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const toggleSymbol = (id: string) =>
    setSymbols((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 15 ? s : [...s, id]));

  const run = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!symbols.length) {
      setError("Choose at least one symbol.");
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const r = await apiFetch<BacktestResponse>("/api/backtest", {
        method: "POST",
        body: JSON.stringify({ symbols, timeframe, bars, target, minStrength, maxBarsInTrade: maxBars, overrides: app.settings.overrides }),
      });
      setResult(r);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const list = [...FEATURED_SYMBOLS, ...SYMBOLS.filter((s) => !s.featured)];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Backtest"
        description="Replay the signal engine over historical candles. Entries fill at the next bar's open; if stop and target are hit in the same bar, the stop is assumed first. No fees or slippage are modelled."
      />
      <Card title="Parameters" subtitle="Engine settings (indicators, thresholds, stops) come from the Settings page.">
        <form onSubmit={run} className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-muted">Symbols ({symbols.length} selected, max 15)</legend>
            <div className="flex flex-wrap gap-1.5">
              {list.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  aria-pressed={symbols.includes(s.id)}
                  onClick={() => toggleSymbol(s.id)}
                  className={cx(
                    "rounded-md border px-2 py-1 text-xs",
                    symbols.includes(s.id) ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-fg",
                  )}
                >
                  {s.display}
                </button>
              ))}
              <button type="button" onClick={() => setSymbols(FEATURED_SYMBOLS.map((s) => s.id))} className="rounded-md px-2 py-1 text-xs text-accent hover:underline">
                Select featured
              </button>
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Field label="Timeframe" htmlFor="bt-tf">
              <select id="bt-tf" className={inputClass} value={timeframe} onChange={(e) => setTimeframe(e.target.value as Timeframe)}>
                {TIMEFRAMES.map((tf) => <option key={tf} value={tf}>{TIMEFRAME_LABEL[tf]}</option>)}
              </select>
            </Field>
            <Field label="History (bars)" htmlFor="bt-bars" hint="300–1000">
              <input id="bt-bars" type="number" min={300} max={1000} step={50} className={inputClass} value={bars} onChange={(e) => setBars(Number(e.target.value))} />
            </Field>
            <Field label="Win target" htmlFor="bt-target">
              <select id="bt-target" className={inputClass} value={target} onChange={(e) => setTarget(e.target.value as "tp1" | "tp2")}>
                <option value="tp1">Take profit 1</option>
                <option value="tp2">Take profit 2</option>
              </select>
            </Field>
            <Field label="Signals traded" htmlFor="bt-min">
              <select id="bt-min" className={inputClass} value={minStrength} onChange={(e) => setMinStrength(e.target.value as "normal" | "strong")}>
                <option value="normal">BUY/SELL and stronger</option>
                <option value="strong">STRONG only</option>
              </select>
            </Field>
            <Field label="Expire after (bars)" htmlFor="bt-max" hint="5–500">
              <input id="bt-max" type="number" min={5} max={500} className={inputClass} value={maxBars} onChange={(e) => setMaxBars(Number(e.target.value))} />
            </Field>
          </div>
          <Button type="submit" variant="primary" disabled={running}>
            {running ? "Running…" : "Run backtest"}
          </Button>
        </form>
      </Card>

      {error && <ErrorState message={error} onRetry={() => run()} />}
      {running && !result && <LoadingState label="Running backtest…" />}
      {!running && !result && !error && (
        <Card>
          <EmptyState title="No backtest yet">Choose symbols and a timeframe, then run the backtest.</EmptyState>
        </Card>
      )}
      {result && (
        <div className={cx("space-y-3", running && "opacity-60")}>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <Badge tone="accent">Historical backtest</Badge>
            {!result.meta.isLive && <Badge tone="warn">Demo data — results are illustrative only</Badge>}
            <span>
              {TIMEFRAME_LABEL[result.timeframe]} · target {result.settings.target.toUpperCase()} ({result.settings.target === "tp1" ? result.settings.tp1R : result.settings.tp2R}R) ·
              expire after {result.settings.maxBarsInTrade} bars
            </span>
          </div>
          <BacktestResults data={result} />
          <p className="text-xs text-muted">Past performance, simulated or otherwise, does not guarantee future results.</p>
        </div>
      )}
    </div>
  );
}
