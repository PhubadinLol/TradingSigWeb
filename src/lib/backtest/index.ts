/**
 * Walk-forward backtester. Replays the signal engine bar by bar over
 * historical candles, using only information available at each bar:
 *
 *  1. At the close of bar i the engine is evaluated (indicators are causal).
 *  2. When the direction changes into BUY/SELL (or stronger), a trade is opened
 *     at the OPEN of bar i+1 — never at the signal bar's close.
 *  3. Stop and target distances come from the signal bar's setup and are
 *     re-anchored to the actual entry price.
 *  4. Each subsequent bar checks stop and target. If both are touched in the
 *     same bar the stop is assumed first (conservative).
 *  5. Trades still open after `maxBarsInTrade` bars are closed at market
 *     ("Expired"). A trade still open at the end of the data is "Active".
 *
 *  Only one trade per symbol/timeframe at a time. No fees or slippage are
 *  modelled — real results would be worse.
 */
import { computeIndicators } from "../analysis";
import { type EngineConfig, warmupBars } from "../config";
import { directionOf, evaluateAt } from "../signals";
import type {
  BacktestMetrics,
  BacktestTrade,
  Candle,
  SignalClass,
  SignalMarker,
  Timeframe,
} from "../types";

export interface BacktestResult {
  trades: BacktestTrade[];
  markers: SignalMarker[];
  metrics: BacktestMetrics;
  equity: { time: number; value: number }[];
  bars: number;
  from: number | null;
  to: number | null;
}

interface OpenPosition {
  trade: BacktestTrade;
  entryIndex: number;
}

export function runBacktest(
  candles: Candle[],
  cfg: EngineConfig,
  symbol: string,
  timeframe: Timeframe,
  opts: { minStrength?: "normal" | "strong" } = {},
): BacktestResult {
  const ind = computeIndicators(candles, cfg.indicators);
  const warmup = warmupBars(cfg);
  const trades: BacktestTrade[] = [];
  const markers: SignalMarker[] = [];
  const target = cfg.risk.backtestTarget;
  const strongOnly = opts.minStrength === "strong";
  let position: OpenPosition | null = null;
  let prevDir = 0;

  const closeTrade = (p: OpenPosition, i: number, price: number, status: BacktestTrade["status"]) => {
    const t = p.trade;
    const risk = Math.abs(t.entry - t.stopLoss);
    const sign = t.direction === "long" ? 1 : -1;
    t.status = status;
    t.exitTime = candles[i].time;
    t.exitPrice = price;
    t.rMultiple = risk > 0 ? ((price - t.entry) * sign) / risk : 0;
    t.barsHeld = i - p.entryIndex + 1;
  };

  for (let i = warmup; i < candles.length; i++) {
    const bar = candles[i];

    // ── Manage the open position on this bar ──────────────────────────────
    if (position && i >= position.entryIndex) {
      const t = position.trade;
      const long = t.direction === "long";
      const hitStop = long ? bar.low <= t.stopLoss : bar.high >= t.stopLoss;
      const hitTarget = long ? bar.high >= t.takeProfit : bar.low <= t.takeProfit;
      if (hitStop) {
        closeTrade(position, i, t.stopLoss, "Stop Hit");
        position = null;
      } else if (hitTarget) {
        closeTrade(position, i, t.takeProfit, "Target Hit");
        position = null;
      } else if (i - position.entryIndex + 1 >= cfg.risk.maxBarsInTrade) {
        closeTrade(position, i, bar.close, "Expired");
        position = null;
      }
    }

    // ── Evaluate the engine at this bar's close ──────────────────────────
    const ev = evaluateAt(candles, ind, i, cfg);
    let dir = directionOf(ev.classification);
    if (strongOnly && ev.classification !== "STRONG_BUY" && ev.classification !== "STRONG_SELL") dir = 0;

    if (dir !== 0 && dir !== prevDir) {
      markers.push({ time: bar.time, classification: ev.classification, score: ev.score, price: bar.close });
      if (!position && ev.setup && i + 1 < candles.length) {
        const entry = candles[i + 1].open;
        const risk = Math.abs(ev.close - ev.setup.stopLoss);
        const tpR = target === "tp1" ? cfg.risk.tp1R : cfg.risk.tp2R;
        position = {
          entryIndex: i + 1,
          trade: {
            id: `${symbol}-${timeframe}-${bar.time}`,
            symbol,
            timeframe,
            signal: ev.classification as SignalClass,
            score: ev.score,
            signalTime: bar.time,
            entryTime: candles[i + 1].time,
            entry,
            stopLoss: entry - dir * risk,
            takeProfit: entry + dir * tpR * risk,
            direction: dir === 1 ? "long" : "short",
            status: "Active",
            exitTime: null,
            exitPrice: null,
            rMultiple: 0,
            barsHeld: 0,
          },
        };
        trades.push(position.trade);
      }
    }
    prevDir = dir;
  }

  // Mark-to-market an unresolved trade (kept as "Active").
  if (position) {
    const t = position.trade;
    const last = candles[candles.length - 1];
    const risk = Math.abs(t.entry - t.stopLoss);
    t.rMultiple = risk > 0 ? ((last.close - t.entry) * (t.direction === "long" ? 1 : -1)) / risk : 0;
    t.barsHeld = candles.length - position.entryIndex;
  }

  return {
    trades,
    markers,
    metrics: computeMetrics(trades),
    equity: equityCurve(trades),
    bars: candles.length,
    from: candles[warmup]?.time ?? null,
    to: candles[candles.length - 1]?.time ?? null,
  };
}

/** Cumulative R of closed trades, ordered by exit time. */
export function equityCurve(trades: BacktestTrade[]): { time: number; value: number }[] {
  const closed = trades.filter((t) => t.status !== "Active" && t.exitTime !== null).sort((a, b) => a.exitTime! - b.exitTime!);
  let cum = 0;
  const out: { time: number; value: number }[] = [];
  for (const t of closed) {
    cum += t.rMultiple;
    const time = t.exitTime!;
    // lightweight-charts needs strictly increasing times.
    if (out.length && out[out.length - 1].time >= time) out[out.length - 1].value = cum;
    else out.push({ time, value: cum });
  }
  return out;
}

export function computeMetrics(trades: BacktestTrade[]): BacktestMetrics {
  const closed = trades.filter((t) => t.status !== "Active");
  const wins = closed.filter((t) => t.rMultiple > 0);
  const losses = closed.filter((t) => t.rMultiple <= 0);
  const grossWin = wins.reduce((a, t) => a + t.rMultiple, 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.rMultiple, 0));
  const totalR = closed.reduce((a, t) => a + t.rMultiple, 0);

  let peak = 0;
  let maxDd = 0;
  for (const p of equityCurve(trades)) {
    peak = Math.max(peak, p.value);
    maxDd = Math.max(maxDd, peak - p.value);
  }

  const durations = closed.filter((t) => t.exitTime !== null).map((t) => t.exitTime! - t.entryTime);

  return {
    totalSignals: trades.length,
    closedTrades: closed.length,
    activeTrades: trades.length - closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate: closed.length ? wins.length / closed.length : null,
    averageR: closed.length ? totalR / closed.length : null,
    totalR,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    maxDrawdownR: maxDd,
    averageDurationSec: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
    targetHits: closed.filter((t) => t.status === "Target Hit").length,
    stopHits: closed.filter((t) => t.status === "Stop Hit").length,
    expired: closed.filter((t) => t.status === "Expired").length,
  };
}
