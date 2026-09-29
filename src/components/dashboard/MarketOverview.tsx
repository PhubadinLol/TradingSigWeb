"use client";

import { useApp } from "@/components/AppProvider";
import { cx, ErrorState, SignalBadge, Skeleton } from "@/components/ui";
import { useMarkets } from "@/hooks/data";
import type { MarketRow } from "@/lib/apiTypes";
import { formatPct, formatPrice } from "@/lib/format";

export function Sparkline({ values, up, className }: { values: number[]; up: boolean; className?: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - ((v - min) / range) * 28 - 1}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={cx("h-8 w-full", className)} aria-hidden>
      <polyline points={pts} fill="none" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Tile({ row, active, onSelect }: { row: MarketRow; active: boolean; onSelect: () => void }) {
  if (!row.ok) {
    return (
      <div className="rounded-xl border border-border bg-panel p-3 text-xs text-muted" title={row.error}>
        <div className="font-medium text-fg">{row.display}</div>
        Unavailable
      </div>
    );
  }
  const up = row.change24hPct >= 0;
  return (
    <button
      onClick={onSelect}
      aria-pressed={active}
      className={cx(
        "rounded-xl border bg-panel p-3 text-left transition-colors hover:border-accent/60",
        active ? "border-accent" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-1">
        <span className="text-sm font-semibold">{row.display}</span>
        <SignalBadge value={row.classification} />
      </div>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="num text-sm">{formatPrice(row.price, row.precision)}</span>
        <span className={cx("num text-xs", up ? "text-up" : "text-down")} title="24-hour change">
          {formatPct(row.change24hPct, 2, true)}
        </span>
      </div>
      <Sparkline values={row.spark} up={up} className="mt-1" />
    </button>
  );
}

export function MarketOverview() {
  const { symbol, setSymbol } = useApp();
  const { data, error, reload } = useMarkets();
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  return (
    <section aria-label="Market overview" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7">
      {!data
        ? Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-xl" />)
        : data.rows.map((r) => <Tile key={r.symbol} row={r} active={r.symbol === symbol} onSelect={() => setSymbol(r.symbol)} />)}
    </section>
  );
}
