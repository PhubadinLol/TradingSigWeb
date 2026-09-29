"use client";

import { Card, cx, ErrorState, Skeleton } from "@/components/ui";
import type { ApiState } from "@/hooks/useApi";
import type { AnalysisResponse } from "@/lib/apiTypes";
import { formatNumber, formatPct, formatPrice } from "@/lib/format";

type Tone = "up" | "down" | "muted" | undefined;

function Tile({ label, value, note, tone }: { label: string; value: string; note: string; tone?: Tone }) {
  return (
    <div className="rounded-lg border border-border bg-panel-2/50 p-3">
      <div className="text-[11px] tracking-wide text-muted uppercase">{label}</div>
      <div className="num mt-1 text-sm font-semibold">{value}</div>
      <div className={cx("mt-0.5 text-xs", tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-muted")}>{note}</div>
    </div>
  );
}

function Flag({ on, label, tone }: { on: boolean; label: string; tone: "up" | "down" }) {
  return (
    <span
      className={cx(
        "rounded-md px-2 py-1 text-xs",
        on ? (tone === "up" ? "bg-up-soft text-up" : "bg-down-soft text-down") : "bg-panel-2 text-muted line-through decoration-muted/50",
      )}
      aria-label={`${label}: ${on ? "detected" : "not detected"}`}
    >
      {label}
    </span>
  );
}

export function IndicatorSummary({ state }: { state: ApiState<AnalysisResponse> }) {
  const { data, error, reload } = state;
  if (error && !data) return <Card title="Indicators"><ErrorState message={error} onRetry={reload} /></Card>;
  if (!data) {
    return (
      <Card title="Indicators">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </Card>
    );
  }

  const s = data.latest.snapshot;
  const pa = data.latest.priceAction;
  const p = data.precision;
  const { emaFast, emaMid, emaSlow } = data.periods;
  const vs = (ema: number | null) => (ema === null ? "—" : s.close > ema ? "Price above" : "Price below");
  const tone = (ema: number | null): Tone => (ema === null ? "muted" : s.close > ema ? "up" : "down");

  const rsiNote = s.rsi === null ? "—" : s.rsi >= 70 ? "Overbought (≥70)" : s.rsi <= 30 ? "Oversold (≤30)" : s.rsi > 50 ? "Bullish momentum" : "Bearish momentum";
  const macdBull = s.macd !== null && s.macdSignal !== null && s.macd > s.macdSignal;
  const bbPos =
    s.bbUpper !== null && s.bbLower !== null && s.bbUpper !== s.bbLower ? ((s.close - s.bbLower) / (s.bbUpper - s.bbLower)) * 100 : null;
  const stochNote =
    s.stochK === null ? "—" : s.stochK >= 80 ? "Overbought zone" : s.stochK <= 20 ? "Oversold zone" : s.stochD !== null && s.stochK > s.stochD ? "%K above %D" : "%K below %D";

  return (
    <Card title="Indicator summary" subtitle="Values at the last closed candle">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label={`EMA ${emaFast}`} value={formatPrice(s.emaFast, p)} note={vs(s.emaFast)} tone={tone(s.emaFast)} />
        <Tile label={`EMA ${emaMid}`} value={formatPrice(s.emaMid, p)} note={vs(s.emaMid)} tone={tone(s.emaMid)} />
        <Tile label={`EMA ${emaSlow}`} value={formatPrice(s.emaSlow, p)} note={vs(s.emaSlow)} tone={tone(s.emaSlow)} />
        <Tile label={`RSI ${data.periods.rsi}`} value={formatNumber(s.rsi, 1)} note={rsiNote} tone={s.rsi === null ? "muted" : s.rsi > 50 ? "up" : "down"} />
        <Tile
          label="MACD"
          value={formatNumber(s.macdHist, p > 3 ? 6 : 3)}
          note={s.macd === null ? "—" : macdBull ? "Line above signal" : "Line below signal"}
          tone={s.macd === null ? "muted" : macdBull ? "up" : "down"}
        />
        <Tile label="Stoch RSI" value={`${formatNumber(s.stochK, 0)} / ${formatNumber(s.stochD, 0)}`} note={stochNote} />
        <Tile label={`ATR ${data.periods.atr}`} value={formatPrice(s.atr, p)} note={`${formatPct(s.atrPct)} of price`} />
        <Tile label="Bollinger" value={`${formatPct(s.bbWidthPct, 2)} wide`} note={bbPos === null ? "—" : `Price at ${bbPos.toFixed(0)}% of band`} />
        <Tile
          label="Volume"
          value={s.volumeRatio === null ? "—" : `${s.volumeRatio.toFixed(2)}× avg`}
          note={pa.volumeSpike ? "Volume spike" : pa.volumeConfirmed ? "Above average" : "Normal"}
          tone={pa.volumeSpike || pa.volumeConfirmed ? "up" : "muted"}
        />
        <Tile
          label="Nearest support"
          value={formatPrice(data.supports[0]?.price, p)}
          note={data.supports[0] ? `${data.supports[0].touches} touch${data.supports[0].touches === 1 ? "" : "es"}` : "None found"}
        />
        <Tile
          label="Nearest resistance"
          value={formatPrice(data.resistances[0]?.price, p)}
          note={data.resistances[0] ? `${data.resistances[0].touches} touch${data.resistances[0].touches === 1 ? "" : "es"}` : "None found"}
        />
        <Tile
          label="EMA cross"
          value={pa.emaCrossUpBarsAgo !== null ? "Golden" : pa.emaCrossDownBarsAgo !== null ? "Death" : "None"}
          note={
            pa.emaCrossUpBarsAgo !== null
              ? `${emaFast}↑${emaMid} ${pa.emaCrossUpBarsAgo} bars ago`
              : pa.emaCrossDownBarsAgo !== null
                ? `${emaFast}↓${emaMid} ${pa.emaCrossDownBarsAgo} bars ago`
                : "No cross in 10 bars"
          }
          tone={pa.emaCrossUpBarsAgo !== null ? "up" : pa.emaCrossDownBarsAgo !== null ? "down" : "muted"}
        />
      </div>
      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-muted">Price action</p>
        <div className="flex flex-wrap gap-1.5">
          <Flag on={pa.breakout} label="Breakout" tone="up" />
          <Flag on={pa.breakdown} label="Breakdown" tone="down" />
          <Flag on={pa.higherHigh} label="Higher high" tone="up" />
          <Flag on={pa.higherLow} label="Higher low" tone="up" />
          <Flag on={pa.lowerHigh} label="Lower high" tone="down" />
          <Flag on={pa.lowerLow} label="Lower low" tone="down" />
          <Flag on={pa.supportBounce} label="Support bounce" tone="up" />
          <Flag on={pa.resistanceRejection} label="Resistance rejection" tone="down" />
        </div>
      </div>
    </Card>
  );
}
