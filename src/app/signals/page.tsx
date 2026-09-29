"use client";

import { useState } from "react";
import { useApp, withConfig } from "@/components/AppProvider";
import { SignalCard } from "@/components/dashboard/SignalCard";
import { TradesTable } from "@/components/TradesTable";
import { Badge, Button, Card, EmptyState, ErrorState, Field, inputClass, LoadingState, PageHeader } from "@/components/ui";
import { useApi } from "@/hooks/useApi";
import type { HistoryResponse } from "@/lib/apiTypes";
import { FEATURED_SYMBOLS, SYMBOLS } from "@/lib/symbols";
import { SIGNAL_LABEL, TIMEFRAMES, TIMEFRAME_LABEL } from "@/lib/types";

interface Filters {
  symbol: string;
  timeframe: string;
  signal: string;
  from: string;
  to: string;
}

const EMPTY: Filters = { symbol: "", timeframe: "", signal: "", from: "", to: "" };

export default function SignalsPage() {
  const { configQuery, ready } = useApp();
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);

  const qs = new URLSearchParams({ limit: "500" });
  for (const [k, v] of Object.entries(applied)) if (v) qs.set(k, v);
  const { data, error, loading, reload } = useApi<HistoryResponse>(ready ? withConfig(`/api/signals/history?${qs}`, configQuery) : null);

  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <PageHeader title="Signals" description="The current signal for the selected market, and the history of signals the engine produced." />

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <SignalCard />

        <Card
          title="Signal history"
          subtitle={
            <>
              Produced by replaying the engine over past candles (walk-forward, no look-ahead) and resolving each signal against later bars.
              {data && !data.meta.isLive && " Based on demo data."}
            </>
          }
          action={data ? <Badge tone="accent">Historical replay</Badge> : undefined}
          bodyClassName="p-0"
        >
          <form
            className="grid grid-cols-2 gap-3 border-b border-border p-4 md:grid-cols-6"
            onSubmit={(e) => {
              e.preventDefault();
              setApplied(draft);
            }}
          >
            <Field label="Symbol" htmlFor="f-symbol">
              <select id="f-symbol" className={inputClass} value={draft.symbol} onChange={set("symbol")}>
                <option value="">Featured ({FEATURED_SYMBOLS.length})</option>
                {SYMBOLS.map((s) => (
                  <option key={s.id} value={s.id}>{s.display}</option>
                ))}
              </select>
            </Field>
            <Field label="Timeframe" htmlFor="f-tf">
              <select id="f-tf" className={inputClass} value={draft.timeframe} onChange={set("timeframe")}>
                <option value="">15m, 1H, 4H, 1D</option>
                {TIMEFRAMES.map((tf) => (
                  <option key={tf} value={tf}>{TIMEFRAME_LABEL[tf]}</option>
                ))}
              </select>
            </Field>
            <Field label="Signal" htmlFor="f-signal">
              <select id="f-signal" className={inputClass} value={draft.signal} onChange={set("signal")}>
                <option value="">All</option>
                {(["STRONG_BUY", "BUY", "SELL", "STRONG_SELL"] as const).map((s) => (
                  <option key={s} value={s}>{SIGNAL_LABEL[s]}</option>
                ))}
              </select>
            </Field>
            <Field label="From (UTC)" htmlFor="f-from">
              <input id="f-from" type="date" className={inputClass} value={draft.from} onChange={set("from")} />
            </Field>
            <Field label="To (UTC)" htmlFor="f-to">
              <input id="f-to" type="date" className={inputClass} value={draft.to} onChange={set("to")} />
            </Field>
            <div className="flex items-end gap-2">
              <Button type="submit" variant="primary" className="flex-1">Apply</Button>
              <Button
                type="button"
                onClick={() => {
                  setDraft(EMPTY);
                  setApplied(EMPTY);
                }}
              >
                Reset
              </Button>
            </div>
          </form>

          {error && !data ? (
            <ErrorState message={error} onRetry={reload} className="m-4" />
          ) : !data || (loading && !data) ? (
            <LoadingState label="Replaying signal history…" />
          ) : data.rows.length === 0 ? (
            <EmptyState title="No signals match these filters">Try widening the date range or choosing a different symbol or timeframe.</EmptyState>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-muted">
                <span>
                  {data.total} signal{data.total === 1 ? "" : "s"}
                  {data.total > data.rows.length && ` (showing latest ${data.rows.length})`}
                  {loading && " · updating…"}
                </span>
                {data.errors.length > 0 && <span className="text-warn" title={data.errors.join("\n")}>{data.errors.length} market(s) unavailable</span>}
              </div>
              <TradesTable rows={data.rows} caption="Signal history" />
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
