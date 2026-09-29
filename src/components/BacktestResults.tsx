"use client";

import dynamic from "next/dynamic";
import { useApp } from "@/components/AppProvider";
import { TradesTable } from "@/components/TradesTable";
import { Card, cx, EmptyState, LoadingState } from "@/components/ui";
import type { BacktestResponse } from "@/lib/apiTypes";
import { formatDateTime, formatDuration, formatNumber, formatPct, formatR } from "@/lib/format";
import type { BacktestMetrics } from "@/lib/types";

const EquityChart = dynamic(() => import("@/components/charts/EquityChart").then((m) => m.EquityChart), {
  ssr: false,
  loading: () => <LoadingState className="h-[240px]" />,
});

function Metric({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={cx("num mt-1 text-lg font-semibold", tone === "up" && "text-up", tone === "down" && "text-down")}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

export function MetricsGrid({ m }: { m: BacktestMetrics }) {
  const tone = (v: number | null, pivot = 0) => (v === null ? undefined : v > pivot ? "up" : v < pivot ? "down" : undefined);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Metric label="Total signals" value={String(m.totalSignals)} hint={`${m.closedTrades} closed · ${m.activeTrades} active`} />
      <Metric label="Winning signals" value={String(m.wins)} hint={`${m.targetHits} hit target`} tone="up" />
      <Metric label="Losing signals" value={String(m.losses)} hint={`${m.stopHits} stopped · ${m.expired} expired`} tone="down" />
      <Metric label="Win rate" value={m.winRate === null ? "—" : formatPct(m.winRate * 100, 1)} hint="of closed trades" />
      <Metric label="Average R multiple" value={formatR(m.averageR)} hint={`Total ${formatR(m.totalR)}`} tone={tone(m.averageR)} />
      <Metric label="Maximum drawdown" value={m.maxDrawdownR ? `−${m.maxDrawdownR.toFixed(2)}R` : "0R"} hint="peak-to-trough, cumulative R" tone={m.maxDrawdownR > 0 ? "down" : undefined} />
      <Metric
        label="Profit factor"
        value={m.profitFactor === null ? (m.wins > 0 ? "∞ (no losses)" : "—") : formatNumber(m.profitFactor, 2)}
        hint="gross win R ÷ gross loss R"
        tone={tone(m.profitFactor, 1)}
      />
      <Metric label="Avg. signal duration" value={formatDuration(m.averageDurationSec)} hint="entry to exit" />
    </div>
  );
}

export function BacktestResults({ data }: { data: BacktestResponse }) {
  const { settings } = useApp();
  const m = data.combined.metrics;
  return (
    <div className="space-y-4">
      <MetricsGrid m={m} />

      <Card title="Equity curve" subtitle="Cumulative R of closed trades (1R = the amount risked per trade). No fees or slippage.">
        {data.combined.equity.length < 2 ? (
          <EmptyState title="Not enough closed trades to plot" />
        ) : (
          <EquityChart points={data.combined.equity} theme={settings.theme} />
        )}
      </Card>

      {data.perSymbol.length > 1 && (
        <Card title="By symbol" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th scope="col" className="px-4 py-2 font-medium">Symbol</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Signals</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Win rate</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Avg R</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Profit factor</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Max DD</th>
                  <th scope="col" className="px-4 py-2 font-medium">Period</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.perSymbol.map((r) =>
                  r.ok ? (
                    <tr key={r.symbol}>
                      <td className="px-4 py-2 font-medium">{r.display}</td>
                      <td className="num px-4 py-2 text-right">{r.metrics.totalSignals}</td>
                      <td className="num px-4 py-2 text-right">{r.metrics.winRate === null ? "—" : formatPct(r.metrics.winRate * 100, 1)}</td>
                      <td className={cx("num px-4 py-2 text-right", (r.metrics.averageR ?? 0) > 0 ? "text-up" : (r.metrics.averageR ?? 0) < 0 ? "text-down" : "")}>
                        {formatR(r.metrics.averageR)}
                      </td>
                      <td className="num px-4 py-2 text-right">{r.metrics.profitFactor === null ? "—" : formatNumber(r.metrics.profitFactor, 2)}</td>
                      <td className="num px-4 py-2 text-right">{r.metrics.maxDrawdownR.toFixed(2)}R</td>
                      <td className="px-4 py-2 text-xs text-muted">
                        {r.from && r.to ? `${formatDateTime(r.from, settings.timezone)} → ${formatDateTime(r.to, settings.timezone)}` : "—"}
                      </td>
                    </tr>
                  ) : (
                    <tr key={r.symbol}>
                      <td className="px-4 py-2 font-medium">{r.display}</td>
                      <td colSpan={6} className="px-4 py-2 text-xs text-muted">{r.error}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title="Trades" subtitle={`${data.trades.length} signals · newest first`} bodyClassName="p-0">
        {data.trades.length === 0 ? (
          <EmptyState title="No signals in this period">The engine did not produce a BUY or SELL signal with these settings.</EmptyState>
        ) : (
          <TradesTable rows={data.trades} caption="Backtest trades" />
        )}
      </Card>
    </div>
  );
}
