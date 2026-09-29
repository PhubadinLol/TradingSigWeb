/**
 * Market analysis: bundles the raw indicators into an IndicatorSet and derives
 * price-action facts (market structure, support/resistance, breakouts) at any
 * bar index without using future bars.
 */
import type { EngineConfig, IndicatorConfig } from "../config";
import { atr, bollinger, ema, macd, sma, stochRsi, rsi } from "../indicators";
import type { Candle, IndicatorSnapshot, Level, PriceActionState, Trend } from "../types";

export interface IndicatorSet {
  closes: number[];
  emaFast: number[];
  emaMid: number[];
  emaSlow: number[];
  rsi: number[];
  macd: number[];
  macdSignal: number[];
  macdHist: number[];
  stochK: number[];
  stochD: number[];
  atr: number[];
  bbUpper: number[];
  bbMiddle: number[];
  bbLower: number[];
  volumeMa: number[];
  pivots: Pivot[];
}

export interface Pivot {
  index: number;
  price: number;
  type: "high" | "low";
}

export function computeIndicators(candles: Candle[], cfg: IndicatorConfig): IndicatorSet {
  const closes = candles.map((c) => c.close);
  const m = macd(closes, cfg.macdFast, cfg.macdSlow, cfg.macdSignal);
  const s = stochRsi(closes, cfg.rsiPeriod, cfg.stochRsiPeriod, cfg.stochK, cfg.stochD);
  const bb = bollinger(closes, cfg.bbPeriod, cfg.bbStdDev);
  return {
    closes,
    emaFast: ema(closes, cfg.emaFast),
    emaMid: ema(closes, cfg.emaMid),
    emaSlow: ema(closes, cfg.emaSlow),
    rsi: rsi(closes, cfg.rsiPeriod),
    macd: m.macd,
    macdSignal: m.signal,
    macdHist: m.histogram,
    stochK: s.k,
    stochD: s.d,
    atr: atr(candles, cfg.atrPeriod),
    bbUpper: bb.upper,
    bbMiddle: bb.middle,
    bbLower: bb.lower,
    volumeMa: sma(
      candles.map((c) => c.volume),
      cfg.volumeMaPeriod,
    ),
    pivots: findPivots(candles, cfg.pivotLookback),
  };
}

const fin = (v: number) => (Number.isFinite(v) ? v : null);

export function snapshotAt(candles: Candle[], ind: IndicatorSet, i: number): IndicatorSnapshot {
  const c = candles[i];
  const atrV = fin(ind.atr[i]);
  const volMa = fin(ind.volumeMa[i]);
  const mid = fin(ind.bbMiddle[i]);
  return {
    close: c.close,
    emaFast: fin(ind.emaFast[i]),
    emaMid: fin(ind.emaMid[i]),
    emaSlow: fin(ind.emaSlow[i]),
    rsi: fin(ind.rsi[i]),
    macd: fin(ind.macd[i]),
    macdSignal: fin(ind.macdSignal[i]),
    macdHist: fin(ind.macdHist[i]),
    stochK: fin(ind.stochK[i]),
    stochD: fin(ind.stochD[i]),
    atr: atrV,
    atrPct: atrV !== null ? (atrV / c.close) * 100 : null,
    bbUpper: fin(ind.bbUpper[i]),
    bbMiddle: mid,
    bbLower: fin(ind.bbLower[i]),
    bbWidthPct: mid ? ((ind.bbUpper[i] - ind.bbLower[i]) / mid) * 100 : null,
    volume: c.volume,
    volumeMa: volMa,
    volumeRatio: volMa ? c.volume / volMa : null,
  };
}

/**
 * Swing pivots: a bar whose high (low) is the extreme of the `lb` bars on each
 * side. A pivot at index p is only *known* at bar p + lb, which callers must
 * respect (see confirmedPivots) to avoid look-ahead.
 */
export function findPivots(candles: Candle[], lb: number): Pivot[] {
  const out: Pivot[] = [];
  for (let i = lb; i < candles.length - lb; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - lb; j <= i + lb && (isHigh || isLow); j++) {
      if (j === i) continue;
      // Strict on the left, non-strict on the right to avoid double-counting equal highs.
      if (j < i ? candles[j].high >= candles[i].high : candles[j].high > candles[i].high) isHigh = false;
      if (j < i ? candles[j].low <= candles[i].low : candles[j].low < candles[i].low) isLow = false;
    }
    if (isHigh) out.push({ index: i, price: candles[i].high, type: "high" });
    if (isLow) out.push({ index: i, price: candles[i].low, type: "low" });
  }
  return out;
}

function confirmedPivots(ind: IndicatorSet, i: number, lb: number, fromIndex: number): Pivot[] {
  return ind.pivots.filter((p) => p.index + lb <= i && p.index >= fromIndex);
}

/**
 * Support & resistance: cluster confirmed swing pivots whose prices are within
 * half an ATR of each other. Levels below the close are support, above are
 * resistance. More touches ⇒ stronger level. Nearest levels come first.
 */
export function supportResistanceAt(
  candles: Candle[],
  ind: IndicatorSet,
  i: number,
  cfg: IndicatorConfig,
): { supports: Level[]; resistances: Level[] } {
  const close = candles[i].close;
  const a = Number.isFinite(ind.atr[i]) ? ind.atr[i] : close * 0.005;
  const tolerance = a * 0.5;
  const prices = confirmedPivots(ind, i, cfg.pivotLookback, i - cfg.srLookback)
    .map((p) => p.price)
    .sort((x, y) => x - y);

  const clusters: { sum: number; n: number }[] = [];
  for (const p of prices) {
    const last = clusters[clusters.length - 1];
    if (last && p - last.sum / last.n <= tolerance) {
      last.sum += p;
      last.n += 1;
    } else clusters.push({ sum: p, n: 1 });
  }
  const levels = clusters.map((c) => ({ price: c.sum / c.n, touches: c.n }));
  const supports = levels
    .filter((l) => l.price < close)
    .sort((x, y) => y.price - x.price)
    .slice(0, 3)
    .map((l) => ({ ...l, kind: "support" as const }));
  const resistances = levels
    .filter((l) => l.price >= close)
    .sort((x, y) => x.price - y.price)
    .slice(0, 3)
    .map((l) => ({ ...l, kind: "resistance" as const }));
  return { supports, resistances };
}

/** Bars since the fast EMA crossed the mid EMA in the given direction (within `within` bars). */
function barsSinceCross(ind: IndicatorSet, i: number, dir: 1 | -1, within = 10): number | null {
  for (let k = 0; k < within && i - k - 1 >= 0; k++) {
    const j = i - k;
    const now = ind.emaFast[j] - ind.emaMid[j];
    const prev = ind.emaFast[j - 1] - ind.emaMid[j - 1];
    if (!Number.isFinite(now) || !Number.isFinite(prev)) return null;
    if (dir === 1 && prev <= 0 && now > 0) return k;
    if (dir === -1 && prev >= 0 && now < 0) return k;
  }
  return null;
}

/**
 * Price-action facts at bar i.
 *
 * - Breakout: within the last 3 bars a close crossed above the highest high of
 *   the preceding `breakoutLookback` bars, and the current close still holds
 *   above that level (confirmation by close, not by wick).
 * - Breakdown: mirror image using lows.
 * - HH/HL/LH/LL: compares the last two confirmed swing highs and lows.
 * - Support bounce: a recent low tested the nearest support (within 0.3 ATR)
 *   and the current bar closed bullish above it.
 * - Resistance rejection: mirror image at the nearest resistance.
 */
export function priceActionAt(
  candles: Candle[],
  ind: IndicatorSet,
  i: number,
  cfg: EngineConfig,
  levels: { supports: Level[]; resistances: Level[] },
): PriceActionState {
  const ic = cfg.indicators;
  const c = candles[i];
  const a = Number.isFinite(ind.atr[i]) ? ind.atr[i] : c.close * 0.005;
  const N = ic.breakoutLookback;

  let breakout = false;
  let breakoutLevel: number | null = null;
  let breakdown = false;
  let breakdownLevel: number | null = null;
  for (let j = i; j > i - 3 && j - N - 1 >= 0; j--) {
    let hi = -Infinity;
    let lo = Infinity;
    for (let k = j - N; k < j; k++) {
      hi = Math.max(hi, candles[k].high);
      lo = Math.min(lo, candles[k].low);
    }
    if (!breakout && candles[j].close > hi && candles[j - 1].close <= hi && c.close > hi) {
      breakout = true;
      breakoutLevel = hi;
    }
    if (!breakdown && candles[j].close < lo && candles[j - 1].close >= lo && c.close < lo) {
      breakdown = true;
      breakdownLevel = lo;
    }
  }

  const piv = confirmedPivots(ind, i, ic.pivotLookback, 0);
  const highs = piv.filter((p) => p.type === "high").slice(-2);
  const lows = piv.filter((p) => p.type === "low").slice(-2);
  const higherHigh = highs.length === 2 && highs[1].price > highs[0].price;
  const lowerHigh = highs.length === 2 && highs[1].price < highs[0].price;
  const higherLow = lows.length === 2 && lows[1].price > lows[0].price;
  const lowerLow = lows.length === 2 && lows[1].price < lows[0].price;

  const recent = candles.slice(Math.max(0, i - 2), i + 1);
  const bullishBar = c.close > c.open;
  const bearishBar = c.close < c.open;
  const s = levels.supports[0];
  const r = levels.resistances[0];
  const supportBounce = !!s && bullishBar && c.close > s.price && Math.min(...recent.map((b) => b.low)) <= s.price + 0.3 * a;
  const resistanceRejection =
    !!r && bearishBar && c.close < r.price && Math.max(...recent.map((b) => b.high)) >= r.price - 0.3 * a;

  const volMa = ind.volumeMa[i];
  const volumeConfirmed = Number.isFinite(volMa) && c.volume > volMa * ic.volumeConfirmMultiplier;
  const volumeSpike = Number.isFinite(volMa) && c.volume > volMa * ic.volumeSpikeMultiplier;

  return {
    breakout,
    breakoutLevel,
    breakdown,
    breakdownLevel,
    higherHigh,
    lowerHigh,
    higherLow,
    lowerLow,
    supportBounce,
    resistanceRejection,
    volumeConfirmed,
    volumeSpike,
    emaCrossUpBarsAgo: barsSinceCross(ind, i, 1),
    emaCrossDownBarsAgo: barsSinceCross(ind, i, -1),
  };
}

/** Trend from EMA stacking and price location relative to the slow EMA. */
export function trendAt(ind: IndicatorSet, i: number): Trend {
  const f = ind.emaFast[i];
  const m = ind.emaMid[i];
  const s = ind.emaSlow[i];
  const c = ind.closes[i];
  if (![f, m, s].every(Number.isFinite)) return "Neutral";
  if (f > m && m > s && c > s) return "Bullish";
  if (f < m && m < s && c < s) return "Bearish";
  return "Neutral";
}
