/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  SIGNAL ALGORITHM
 * ─────────────────────────────────────────────────────────────────────────────
 *  No single indicator can produce a signal. Instead, independent pieces of
 *  evidence are scored and summed separately for each side:
 *
 *    BUY side                               SELL side
 *    ─────────────────────────────  ──────  ─────────────────────────────
 *    EMA fast > mid > slow           +20    EMA fast < mid < slow
 *    Close above EMA slow (200)      +15    Close below EMA slow (200)
 *    RSI > 50                        +10    RSI < 50
 *    MACD line > signal line         +15    MACD line < signal line
 *    Confirmed breakout              +20    Confirmed breakdown
 *    Volume > avg × k, bullish bar   +10    Volume > avg × k, bearish bar
 *    Support bounce                  +10    Resistance rejection
 *
 *  (Weights live in config.ts → SignalWeights and are configurable.)
 *
 *    signalScore = buyScore − sellScore        ∈ [−100, +100]
 *
 *  Classification (thresholds configurable, defaults shown):
 *    score ≥ +60 → STRONG BUY      +30 … +59 → BUY
 *    −29 … +29   → NEUTRAL
 *    −59 … −30   → SELL            score ≤ −60 → STRONG SELL
 *
 *  "Signal strength" = |signalScore|. It measures how much of the weighted
 *  evidence agrees — it is NOT a calibrated probability of profit.
 *
 *  The engine is a pure function of (candles, precomputed indicators, index,
 *  config), and every input at index i only uses data up to i. That makes the
 *  exact same code usable for the live signal and for walk-forward backtests.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { priceActionAt, snapshotAt, supportResistanceAt, trendAt, type IndicatorSet } from "../analysis";
import type { EngineConfig, SignalThresholds } from "../config";
import type { Candle, Level, SignalClass, SignalEvaluation, SignalFactor, TradeSetup } from "../types";
import { SIGNAL_LABEL } from "../types";

export function classify(score: number, t: SignalThresholds): SignalClass {
  if (score >= t.strongBuy) return "STRONG_BUY";
  if (score >= t.buy) return "BUY";
  if (score <= t.strongSell) return "STRONG_SELL";
  if (score <= t.sell) return "SELL";
  return "NEUTRAL";
}

export function directionOf(c: SignalClass): 1 | -1 | 0 {
  return c === "BUY" || c === "STRONG_BUY" ? 1 : c === "SELL" || c === "STRONG_SELL" ? -1 : 0;
}

const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

/** Evaluate the signal at bar index i. */
export function evaluateAt(candles: Candle[], ind: IndicatorSet, i: number, cfg: EngineConfig): SignalEvaluation {
  const w = cfg.weights;
  const c = candles[i];
  const snap = snapshotAt(candles, ind, i);
  const levels = supportResistanceAt(candles, ind, i, cfg.indicators);
  const pa = priceActionAt(candles, ind, i, cfg, levels);
  const { emaFast: f, emaMid: m, emaSlow: s, rsi: r, macd: mc, macdSignal: ms } = snap;
  const ic = cfg.indicators;

  const has = (...v: (number | null)[]) => v.every((x) => x !== null);
  const bullStack = has(f, m, s) && f! > m! && m! > s!;
  const bearStack = has(f, m, s) && f! < m! && m! < s!;
  const bullBar = c.close > c.open;
  const bearBar = c.close < c.open;

  const crossUp = pa.emaCrossUpBarsAgo;
  const crossDown = pa.emaCrossDownBarsAgo;
  const barsAgo = (n: number) => (n === 0 ? "on this bar" : `${n} bar${n === 1 ? "" : "s"} ago`);

  const factors: SignalFactor[] = [
    // ── Trend ──────────────────────────────────────────────────────────────
    {
      id: "ema_align_bull", side: "buy", weight: w.emaAlignment, met: bullStack,
      label: crossUp !== null ? `EMA ${ic.emaFast} crossed above EMA ${ic.emaMid}` : "Bullish EMA alignment",
      detail: crossUp !== null
        ? `Crossed ${barsAgo(crossUp)}; EMA ${ic.emaFast} > ${ic.emaMid} > ${ic.emaSlow}`
        : `EMA ${ic.emaFast} > EMA ${ic.emaMid} > EMA ${ic.emaSlow}`,
    },
    {
      id: "ema_align_bear", side: "sell", weight: w.emaAlignment, met: bearStack,
      label: crossDown !== null ? `EMA ${ic.emaFast} crossed below EMA ${ic.emaMid}` : "Bearish EMA alignment",
      detail: crossDown !== null
        ? `Crossed ${barsAgo(crossDown)}; EMA ${ic.emaFast} < ${ic.emaMid} < ${ic.emaSlow}`
        : `EMA ${ic.emaFast} < EMA ${ic.emaMid} < EMA ${ic.emaSlow}`,
    },
    {
      id: "above_slow", side: "buy", weight: w.priceVsEmaSlow, met: s !== null && c.close > s,
      label: `Price above EMA ${ic.emaSlow}`, detail: "Long-term trend filter is bullish",
    },
    {
      id: "below_slow", side: "sell", weight: w.priceVsEmaSlow, met: s !== null && c.close < s,
      label: `Price below EMA ${ic.emaSlow}`, detail: "Long-term trend filter is bearish",
    },
    // ── Momentum ───────────────────────────────────────────────────────────
    {
      id: "rsi_bull", side: "buy", weight: w.rsi, met: r !== null && r > 50,
      label: `RSI ${r !== null ? round(r) : "—"}`,
      detail: r !== null && r > 70 ? "Above 50 (note: overbought above 70)" : "RSI above 50 — bullish momentum",
    },
    {
      id: "rsi_bear", side: "sell", weight: w.rsi, met: r !== null && r < 50,
      label: `RSI ${r !== null ? round(r) : "—"}`,
      detail: r !== null && r < 30 ? "Below 50 (note: oversold below 30)" : "RSI below 50 — bearish momentum",
    },
    {
      id: "macd_bull", side: "buy", weight: w.macd, met: has(mc, ms) && mc! > ms!,
      label: "MACD bullish", detail: "MACD line above its signal line",
    },
    {
      id: "macd_bear", side: "sell", weight: w.macd, met: has(mc, ms) && mc! < ms!,
      label: "MACD bearish", detail: "MACD line below its signal line",
    },
    // ── Price action ───────────────────────────────────────────────────────
    {
      id: "breakout", side: "buy", weight: w.breakout, met: pa.breakout,
      label: "Breakout confirmed",
      detail: `Close held above the ${ic.breakoutLookback}-bar high`,
    },
    {
      id: "breakdown", side: "sell", weight: w.breakout, met: pa.breakdown,
      label: "Breakdown confirmed",
      detail: `Close held below the ${ic.breakoutLookback}-bar low`,
    },
    // ── Volume ─────────────────────────────────────────────────────────────
    {
      id: "vol_bull", side: "buy", weight: w.volume, met: pa.volumeConfirmed && bullBar,
      label: "Volume above average",
      detail: `${snap.volumeRatio !== null ? round(snap.volumeRatio, 2) : "—"}× average on a bullish bar`,
    },
    {
      id: "vol_bear", side: "sell", weight: w.volume, met: pa.volumeConfirmed && bearBar,
      label: "Volume above average",
      detail: `${snap.volumeRatio !== null ? round(snap.volumeRatio, 2) : "—"}× average on a bearish bar`,
    },
    {
      id: "support_bounce", side: "buy", weight: w.srReaction, met: pa.supportBounce,
      label: "Support bounce", detail: "Recent low tested support and closed higher",
    },
    {
      id: "resistance_reject", side: "sell", weight: w.srReaction, met: pa.resistanceRejection,
      label: "Resistance rejection", detail: "Recent high tested resistance and closed lower",
    },
  ];

  const buyScore = factors.filter((x) => x.side === "buy" && x.met).reduce((a, x) => a + x.weight, 0);
  const sellScore = factors.filter((x) => x.side === "sell" && x.met).reduce((a, x) => a + x.weight, 0);
  const score = Math.max(-100, Math.min(100, buyScore - sellScore));
  const classification = classify(score, cfg.thresholds);
  const setup = buildSetup(classification, c.close, snap.atr, levels.supports, levels.resistances, cfg);

  return {
    index: i,
    time: c.time,
    close: c.close,
    buyScore,
    sellScore,
    score,
    classification,
    strength: Math.abs(score),
    trend: trendAt(ind, i),
    factors,
    snapshot: snap,
    priceAction: pa,
    supports: levels.supports,
    resistances: levels.resistances,
    setup,
    explanation: explain(classification, score, buyScore, sellScore, factors, cfg.thresholds),
  };
}

/**
 * Trade levels for a directional signal.
 *  - Entry zone: close ± entryZoneAtr × ATR (on the pull-back side).
 *  - Stop: just beyond the nearest structural level when it sits between
 *    0.5 and 3 ATR away; otherwise atrStopMultiplier × ATR.
 *  - Targets: tp1R / tp2R multiples of the initial risk.
 */
export function buildSetup(
  cls: SignalClass,
  close: number,
  atrV: number | null,
  supports: Level[],
  resistances: Level[],
  cfg: EngineConfig,
): TradeSetup | null {
  const dir = directionOf(cls);
  if (dir === 0 || atrV === null || atrV <= 0) return null;
  const rc = cfg.risk;
  const zone = rc.entryZoneAtr * atrV;
  const entryLow = dir === 1 ? close - zone : close;
  const entryHigh = dir === 1 ? close : close + zone;

  let stop = close - dir * rc.atrStopMultiplier * atrV;
  const structural = dir === 1 ? supports[0]?.price : resistances[0]?.price;
  if (structural !== undefined) {
    const candidate = structural - dir * 0.25 * atrV;
    const dist = Math.abs(close - candidate);
    if (dist >= 0.5 * atrV && dist <= 3 * atrV) stop = candidate;
  }
  const risk = Math.abs(close - stop);
  const tp1 = close + dir * rc.tp1R * risk;
  const tp2 = close + dir * rc.tp2R * risk;
  // R:R measured from the middle of the entry zone.
  const mid = (entryLow + entryHigh) / 2;
  const riskMid = Math.abs(mid - stop);
  return {
    direction: dir === 1 ? "long" : "short",
    entryLow,
    entryHigh,
    stopLoss: stop,
    takeProfit1: tp1,
    takeProfit2: tp2,
    riskReward1: riskMid > 0 ? Math.abs(tp1 - mid) / riskMid : 0,
    riskReward2: riskMid > 0 ? Math.abs(tp2 - mid) / riskMid : 0,
  };
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const PHRASES: Record<string, string> = {
  ema_align_bull: "the EMAs are stacked bullishly",
  ema_align_bear: "the EMAs are stacked bearishly",
  above_slow: "price is above the long-term EMA",
  below_slow: "price is below the long-term EMA",
  rsi_bull: "RSI is above 50",
  rsi_bear: "RSI is below 50",
  macd_bull: "MACD is bullish",
  macd_bear: "MACD is bearish",
  breakout: "a resistance breakout has been confirmed",
  breakdown: "a support breakdown has been confirmed",
  vol_bull: "buying volume is above average",
  vol_bear: "selling volume is above average",
  support_bounce: "price bounced off support",
  resistance_reject: "price was rejected at resistance",
};

/** Plain-English explanation of why the engine produced this classification. */
export function explain(
  cls: SignalClass,
  score: number,
  buy: number,
  sell: number,
  factors: SignalFactor[],
  t: SignalThresholds,
): string {
  const label = SIGNAL_LABEL[cls];
  const dir = directionOf(cls);
  const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  if (dir === 0) {
    return `${label} because bullish (${buy}) and bearish (${sell}) evidence roughly offset: the net score ${signed(score)} is inside the neutral band (${t.sell + 1} to ${t.buy - 1}).`;
  }
  const side = dir === 1 ? "buy" : "sell";
  const reasons = factors.filter((f) => f.side === side && f.met).map((f) => PHRASES[f.id] ?? f.label);
  const against = factors.filter((f) => f.side !== side && f.met).map((f) => PHRASES[f.id] ?? f.label);
  let text = `${label} because ${joinList(reasons)} (net score ${signed(score)}).`;
  if (against.length) text += ` Against it: ${joinList(against)}.`;
  return text;
}
