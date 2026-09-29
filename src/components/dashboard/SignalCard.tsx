"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Icons } from "@/components/icons";
import { Card, cx, ErrorState, SignalBadge, Skeleton, TrendLabel } from "@/components/ui";
import { useSignal } from "@/hooks/data";
import { formatDateTime, formatPrice, timeAgo } from "@/lib/format";
import { TIMEFRAME_LABEL } from "@/lib/types";

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function Row({ label, children, tone }: { label: string; children: React.ReactNode; tone?: "up" | "down" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cx("num text-right text-sm font-medium", tone === "up" && "text-up", tone === "down" && "text-down")}>{children}</dd>
    </div>
  );
}

export function SignalCard() {
  const { settings } = useApp();
  const { data, error, loading, reload } = useSignal();
  const now = useNow();

  if (error && !data) return <Card title="Signal"><ErrorState message={error} onRetry={reload} /></Card>;
  if (!data) {
    return (
      <Card title="Signal">
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </Card>
    );
  }

  const s = data.signal;
  const ev = s.evaluation;
  const p = s.precision;
  const dir = ev.classification === "NEUTRAL" ? 0 : ev.classification.includes("BUY") ? 1 : -1;
  const side = dir === 1 ? "buy" : "sell";
  const supporting = dir === 0 ? [] : ev.factors.filter((f) => f.side === side && f.met);
  const against = dir === 0 ? [] : ev.factors.filter((f) => f.side !== side && f.met);
  const bullish = ev.factors.filter((f) => f.side === "buy" && f.met);
  const bearish = ev.factors.filter((f) => f.side === "sell" && f.met);
  const setup = ev.setup;
  const riskHref = setup
    ? `/risk?entry=${((setup.entryLow + setup.entryHigh) / 2).toFixed(p)}&sl=${setup.stopLoss.toFixed(p)}&tp=${setup.takeProfit1.toFixed(p)}`
    : "/risk";

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          {s.display}
          <span className="rounded bg-panel-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">{TIMEFRAME_LABEL[s.timeframe]}</span>
        </span>
      }
      action={
        <button onClick={reload} className="grid size-7 place-items-center rounded-md text-muted hover:bg-panel-2 hover:text-fg" aria-label="Refresh signal">
          <Icons.refresh className={cx(loading && "animate-spin")} />
        </button>
      }
    >
      <div aria-live="polite" className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <SignalBadge value={ev.classification} size="lg" />
          <div className="text-xs text-muted">
            Net score <span className={cx("num font-semibold", ev.score > 0 ? "text-up" : ev.score < 0 ? "text-down" : "text-fg")}>{ev.score > 0 ? "+" : ""}{ev.score}</span>
            <span className="mx-1">·</span>buy {ev.buyScore} / sell {ev.sellScore}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-baseline justify-between text-xs">
            <span className="text-muted" title="Share of weighted evidence that agrees. Not a probability of profit.">
              Signal strength score
            </span>
            <span className="num font-semibold">{ev.strength}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-panel-2" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={ev.strength} aria-label="Signal strength score">
            <div className={cx("h-full rounded-full", dir === 1 ? "bg-up" : dir === -1 ? "bg-down" : "bg-muted")} style={{ width: `${ev.strength}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-muted">Measures indicator agreement — not a calibrated probability of profit.</p>
        </div>

        <dl className="divide-y divide-border rounded-lg border border-border px-3">
          {setup ? (
            <>
              <Row label="Entry zone">
                {formatPrice(setup.entryLow, p)} – {formatPrice(setup.entryHigh, p)}
              </Row>
              <Row label="Stop loss" tone="down">{formatPrice(setup.stopLoss, p)}</Row>
              <Row label="Take profit 1" tone="up">{formatPrice(setup.takeProfit1, p)}</Row>
              <Row label="Take profit 2" tone="up">{formatPrice(setup.takeProfit2, p)}</Row>
              <Row label="Risk / reward">
                1 : {setup.riskReward1.toFixed(1)} <span className="text-muted">/</span> 1 : {setup.riskReward2.toFixed(1)}
              </Row>
            </>
          ) : (
            <div className="py-2 text-xs text-muted">No trade setup — the signal is neutral. Levels are only shown for BUY/SELL signals.</div>
          )}
          <Row label="Trend"><TrendLabel value={ev.trend} /></Row>
          <Row label="Last close">{formatPrice(ev.close, p)}</Row>
          <Row label="Signal generated">
            <span title={formatDateTime(s.since, settings.timezone)}>{timeAgo(s.since, now)}</span>
          </Row>
        </dl>

        <div>
          <p className="text-sm leading-relaxed">{ev.explanation}</p>
          {dir !== 0 ? (
            <ul className="mt-3 space-y-1.5">
              {supporting.map((f) => (
                <li key={f.id} className="flex items-start gap-2 text-sm">
                  <Icons.check className={cx("mt-0.5 shrink-0", dir === 1 ? "text-up" : "text-down")} />
                  <span>
                    {f.label} <span className="text-xs text-muted">· {f.detail} (+{f.weight})</span>
                  </span>
                </li>
              ))}
              {against.map((f) => (
                <li key={f.id} className="flex items-start gap-2 text-sm text-muted">
                  <Icons.x className="mt-0.5 shrink-0" />
                  <span>
                    Against: {f.label} <span className="text-xs">(−{f.weight})</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="mb-1 font-medium text-up">Bullish factors ({bullish.length})</p>
                <ul className="space-y-1 text-muted">{bullish.length ? bullish.map((f) => <li key={f.id}>+{f.weight} {f.label}</li>) : <li>None</li>}</ul>
              </div>
              <div>
                <p className="mb-1 font-medium text-down">Bearish factors ({bearish.length})</p>
                <ul className="space-y-1 text-muted">{bearish.length ? bearish.map((f) => <li key={f.id}>−{f.weight} {f.label}</li>) : <li>None</li>}</ul>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted">
          <span>
            {data.meta.isLive ? `Live data · ${data.meta.providerName}` : "Demo data"} · closed candles only
          </span>
          {setup && (
            <Link href={riskHref} className="font-medium text-accent hover:underline">
              Size this in the risk calculator →
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
