/**
 * Technical indicators. Every function is causal: the value at index i only
 * depends on inputs at indices ≤ i, so the same arrays can be reused by the
 * backtester without look-ahead bias. Warm-up values are NaN.
 */
import type { Candle } from "../types";

const nanArray = (n: number) => new Array<number>(n).fill(NaN);

function firstFinite(values: number[]): number {
  for (let i = 0; i < values.length; i++) if (Number.isFinite(values[i])) return i;
  return -1;
}

/** Simple moving average. Leading NaNs in the input are skipped. */
export function sma(values: number[], period: number): number[] {
  const out = nanArray(values.length);
  const start = firstFinite(values);
  if (start < 0 || period < 1) return out;
  let sum = 0;
  for (let i = start; i < values.length; i++) {
    sum += values[i];
    if (i - start >= period) sum -= values[i - period];
    if (i - start >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Exponential moving average, seeded with the SMA of the first `period` values. */
export function ema(values: number[], period: number): number[] {
  const out = nanArray(values.length);
  const start = firstFinite(values);
  if (start < 0 || period < 1 || values.length - start < period) return out;
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = start; i < start + period; i++) seed += values[i];
  let prev = seed / period;
  out[start + period - 1] = prev;
  for (let i = start + period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Relative Strength Index using Wilder's smoothing. */
export function rsi(closes: number[], period = 14): number[] {
  const out = nanArray(closes.length);
  if (closes.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  const toRsi = () => (avgLoss === 0 ? (avgGain === 0 ? 50 : 100) : 100 - 100 / (1 + avgGain / avgLoss));
  out[period] = toRsi();
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = toRsi();
  }
  return out;
}

export interface MacdResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

export function macd(closes: number[], fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  const line = closes.map((_, i) => fastEma[i] - slowEma[i]);
  const signal = ema(line, signalPeriod);
  const histogram = line.map((v, i) => v - signal[i]);
  return { macd: line, signal, histogram };
}

export interface StochRsiResult {
  k: number[];
  d: number[];
}

/** Stochastic RSI: where RSI sits within its own recent range, smoothed into %K and %D. */
export function stochRsi(closes: number[], rsiPeriod = 14, stochPeriod = 14, kPeriod = 3, dPeriod = 3): StochRsiResult {
  const r = rsi(closes, rsiPeriod);
  const raw = nanArray(closes.length);
  for (let i = 0; i < r.length; i++) {
    if (i < stochPeriod - 1) continue;
    let lo = Infinity;
    let hi = -Infinity;
    let ok = true;
    for (let j = i - stochPeriod + 1; j <= i; j++) {
      if (!Number.isFinite(r[j])) {
        ok = false;
        break;
      }
      lo = Math.min(lo, r[j]);
      hi = Math.max(hi, r[j]);
    }
    if (!ok) continue;
    raw[i] = hi === lo ? 50 : ((r[i] - lo) / (hi - lo)) * 100;
  }
  const k = sma(raw, kPeriod);
  const d = sma(k, dPeriod);
  return { k, d };
}

/** Average True Range (Wilder). */
export function atr(candles: Candle[], period = 14): number[] {
  const out = nanArray(candles.length);
  if (candles.length < period) return out;
  const tr = candles.map((c, i) =>
    i === 0
      ? c.high - c.low
      : Math.max(c.high - c.low, Math.abs(c.high - candles[i - 1].close), Math.abs(c.low - candles[i - 1].close)),
  );
  let prev = 0;
  for (let i = 0; i < period; i++) prev += tr[i];
  prev /= period;
  out[period - 1] = prev;
  for (let i = period; i < candles.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

export interface BollingerResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

export function bollinger(closes: number[], period = 20, mult = 2): BollingerResult {
  const middle = sma(closes, period);
  const upper = nanArray(closes.length);
  const lower = nanArray(closes.length);
  for (let i = period - 1; i < closes.length; i++) {
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) variance += (closes[j] - middle[i]) ** 2;
    const sd = Math.sqrt(variance / period);
    upper[i] = middle[i] + mult * sd;
    lower[i] = middle[i] - mult * sd;
  }
  return { upper, middle, lower };
}
