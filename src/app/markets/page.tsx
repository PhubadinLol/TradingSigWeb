"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Sparkline } from "@/components/dashboard/MarketOverview";
import { Card, cx, EmptyState, ErrorState, LoadingState, PageHeader, SignalBadge, TrendLabel, inputClass } from "@/components/ui";
import { useMarkets } from "@/hooks/data";
import { formatNumber, formatPct, formatPrice } from "@/lib/format";
import { TIMEFRAME_LABEL } from "@/lib/types";

const CLASSES = [
  { id: "all", label: "All" },
  { id: "crypto", label: "Crypto" },
  { id: "forex", label: "Forex" },
  { id: "metal", label: "Metals" },
];

export default function MarketsPage() {
  const { timeframe, setSymbol } = useApp();
  const router = useRouter();
  const { data, error, loading, reload } = useMarkets(true);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  const rows = useMemo(
    () =>
      (data?.rows ?? []).filter(
        (r) =>
          (filter === "all" || r.assetClass === filter) &&
          (!q || `${r.display} ${r.name}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [data, filter, q],
  );

  const open = (id: string) => {
    setSymbol(id);
    router.push("/");
  };

  return (
    <div>
      <PageHeader title="Markets" description={`All supported symbols with the engine's signal on the ${TIMEFRAME_LABEL[timeframe]} timeframe. Select a row to open it on the dashboard.`} />
      <Card
        title="Watchlist"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Asset class" className="flex rounded-md border border-border bg-panel-2 p-0.5">
              {CLASSES.map((c) => (
                <button
                  key={c.id}
                  aria-pressed={filter === c.id}
                  onClick={() => setFilter(c.id)}
                  className={cx("rounded px-2 py-1 text-xs", filter === c.id ? "bg-panel text-fg shadow-sm" : "text-muted hover:text-fg")}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <input aria-label="Filter markets" placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} className={cx(inputClass, "w-36 py-1")} />
          </div>
        }
        bodyClassName="p-0"
      >
        {error && !data ? (
          <ErrorState message={error} onRetry={reload} className="m-4" />
        ) : !data && loading ? (
          <LoadingState label="Analysing markets…" />
        ) : rows.length === 0 ? (
          <EmptyState title="No markets match">Try a different filter.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th scope="col" className="px-4 py-2 font-medium">Symbol</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Price</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">24h</th>
                  <th scope="col" className="w-32 px-4 py-2 font-medium">Trend</th>
                  <th scope="col" className="px-4 py-2 font-medium">Signal</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Score</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">RSI</th>
                  <th scope="col" className="w-32 px-4 py-2 font-medium"><span className="sr-only">Sparkline</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) =>
                  r.ok ? (
                    <tr key={r.symbol} className="cursor-pointer hover:bg-panel-2/60" onClick={() => open(r.symbol)}>
                      <td className="px-4 py-2">
                        <button onClick={() => open(r.symbol)} className="text-left">
                          <span className="font-medium">{r.display}</span>
                          <span className="block text-xs text-muted">{r.name}</span>
                        </button>
                      </td>
                      <td className="num px-4 py-2 text-right">{formatPrice(r.price, r.precision)}</td>
                      <td className={cx("num px-4 py-2 text-right", r.change24hPct >= 0 ? "text-up" : "text-down")}>{formatPct(r.change24hPct, 2, true)}</td>
                      <td className="px-4 py-2"><TrendLabel value={r.trend} /></td>
                      <td className="px-4 py-2"><SignalBadge value={r.classification} /></td>
                      <td className={cx("num px-4 py-2 text-right", r.score > 0 ? "text-up" : r.score < 0 ? "text-down" : "text-muted")}>
                        {r.score > 0 ? "+" : ""}{r.score}
                      </td>
                      <td className="num px-4 py-2 text-right">{formatNumber(r.rsi, 1)}</td>
                      <td className="px-4 py-2"><Sparkline values={r.spark} up={r.change24hPct >= 0} /></td>
                    </tr>
                  ) : (
                    <tr key={r.symbol}>
                      <td className="px-4 py-2 font-medium">{r.display}</td>
                      <td colSpan={7} className="px-4 py-2 text-xs text-muted">{r.error}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
