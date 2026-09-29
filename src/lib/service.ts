/**
 * Application services used by the API routes. Keeps route handlers thin:
 * fetch candles → run indicators/engine → shape the response.
 */
import { computeIndicators } from "./analysis";
import { runBacktest, computeMetrics, equityCurve, type BacktestResult } from "./backtest";
import { type EngineConfig, warmupBars } from "./config";
import { getCandles, getMeta, getProviderState } from "./data";
import { ProviderError } from "./data/provider";
import { classify, directionOf, evaluateAt } from "./signals";
import { FEATURED_SYMBOLS, SYMBOLS, type SymbolInfo } from "./symbols";
import {
  TIMEFRAMES,
  TIMEFRAME_SECONDS,
  type BacktestTrade,
  type Candle,
  type SignalClass,
  type SignalEvaluation,
  type Timeframe,
  type Trend,
} from "./types";

const ANALYSIS_BARS = 1000;

/**
 * Signals are computed on CLOSED candles only, so they don't repaint while the
 * current bar is still forming.
 */
export function closedCandles(candles: Candle[], tf: Timeframe, nowSec = Date.now() / 1000): Candle[] {
  const last = candles[candles.length - 1];
  if (last && last.time + TIMEFRAME_SECONDS[tf] > nowSec) return candles.slice(0, -1);
  return candles;
}

function ensureEnoughData(candles: Candle[], cfg: EngineConfig, symbol: SymbolInfo, tf: Timeframe) {
  const need = warmupBars(cfg) + 5;
  if (candles.length < need) {
    throw new ProviderError(
      `Not enough history for ${symbol.display} ${tf}: have ${candles.length} candles, need at least ${need}.`,
      422,
    );
  }
}

// ── Signal ───────────────────────────────────────────────────────────────────

export interface SignalSummary {
  symbol: string;
  display: string;
  precision: number;
  timeframe: Timeframe;
  evaluation: SignalEvaluation;
  /** Close time of the bar where the current classification began. */
  since: number;
  barCloseTime: number;
  thresholds: EngineConfig["thresholds"];
}

export function summarize(candles: Candle[], symbol: SymbolInfo, tf: Timeframe, cfg: EngineConfig): SignalSummary {
  const ind = computeIndicators(candles, cfg.indicators);
  const last = candles.length - 1;
  const evaluation = evaluateAt(candles, ind, last, cfg);
  // Walk back to find when the current classification started.
  let start = last;
  const minIdx = Math.max(warmupBars(cfg), last - 300);
  while (start - 1 >= minIdx) {
    const prev = evaluateAt(candles, ind, start - 1, cfg);
    if (prev.classification !== evaluation.classification) break;
    start--;
  }
  const tfSec = TIMEFRAME_SECONDS[tf];
  return {
    symbol: symbol.id,
    display: symbol.display,
    precision: symbol.precision,
    timeframe: tf,
    evaluation,
    since: candles[start].time + tfSec,
    barCloseTime: candles[last].time + tfSec,
    thresholds: cfg.thresholds,
  };
}

export async function getSignal(symbol: SymbolInfo, tf: Timeframe, cfg: EngineConfig) {
  const candles = closedCandles(await getCandles(symbol, tf, ANALYSIS_BARS), tf);
  ensureEnoughData(candles, cfg, symbol, tf);
  return { meta: getMeta(symbol), signal: summarize(candles, symbol, tf, cfg) };
}

// ── Chart analysis ───────────────────────────────────────────────────────────

type Point = { time: number; value: number };

function toPoints(candles: Candle[], values: number[], from: number): Point[] {
  const out: Point[] = [];
  for (let i = from; i < candles.length; i++) {
    if (Number.isFinite(values[i])) out.push({ time: candles[i].time, value: values[i] });
  }
  return out;
}

export async function getAnalysis(symbol: SymbolInfo, tf: Timeframe, cfg: EngineConfig, limit: number) {
  const all = await getCandles(symbol, tf, ANALYSIS_BARS);
  const closed = closedCandles(all, tf);
  ensureEnoughData(closed, cfg, symbol, tf);
  const ind = computeIndicators(closed, cfg.indicators);
  const from = Math.max(0, all.length - limit);
  const latest = evaluateAt(closed, ind, closed.length - 1, cfg);
  const bt = runBacktest(closed, cfg, symbol.id, tf);
  const firstTime = all[from].time;

  return {
    meta: getMeta(symbol),
    symbol: symbol.id,
    display: symbol.display,
    precision: symbol.precision,
    timeframe: tf,
    candles: all.slice(from),
    formingBar: all.length > closed.length,
    series: {
      emaFast: toPoints(closed, ind.emaFast, from),
      emaMid: toPoints(closed, ind.emaMid, from),
      emaSlow: toPoints(closed, ind.emaSlow, from),
      bbUpper: toPoints(closed, ind.bbUpper, from),
      bbLower: toPoints(closed, ind.bbLower, from),
      rsi: toPoints(closed, ind.rsi, from),
      macdHist: toPoints(closed, ind.macdHist, from),
    },
    periods: {
      emaFast: cfg.indicators.emaFast,
      emaMid: cfg.indicators.emaMid,
      emaSlow: cfg.indicators.emaSlow,
      rsi: cfg.indicators.rsiPeriod,
      atr: cfg.indicators.atrPeriod,
    },
    supports: latest.supports,
    resistances: latest.resistances,
    markers: bt.markers.filter((m) => m.time >= firstTime),
    latest: {
      snapshot: latest.snapshot,
      priceAction: latest.priceAction,
      trend: latest.trend,
      classification: latest.classification,
      score: latest.score,
    },
  };
}

// ── Multi-timeframe ──────────────────────────────────────────────────────────

export interface MtfRow {
  timeframe: Timeframe;
  ok: boolean;
  error?: string;
  classification?: SignalClass;
  score?: number;
  trend?: Trend;
  weight: number;
}

export async function getMultiTimeframe(symbol: SymbolInfo, cfg: EngineConfig, timeframes: Timeframe[] = TIMEFRAMES) {
  const rows: MtfRow[] = await Promise.all(
    timeframes.map(async (tf): Promise<MtfRow> => {
      const weight = cfg.mtfWeights[tf];
      try {
        const candles = closedCandles(await getCandles(symbol, tf, ANALYSIS_BARS), tf);
        ensureEnoughData(candles, cfg, symbol, tf);
        const ind = computeIndicators(candles, cfg.indicators);
        const ev = evaluateAt(candles, ind, candles.length - 1, cfg);
        return { timeframe: tf, ok: true, classification: ev.classification, score: ev.score, trend: ev.trend, weight };
      } catch (e) {
        return { timeframe: tf, ok: false, error: (e as Error).message, weight };
      }
    }),
  );
  // Overall bias = weight-averaged score across timeframes that returned data.
  const valid = rows.filter((r) => r.ok);
  const totalW = valid.reduce((a, r) => a + r.weight, 0);
  const biasScore = totalW > 0 ? valid.reduce((a, r) => a + r.weight * (r.score ?? 0), 0) / totalW : null;
  const biasClass = biasScore !== null ? classify(biasScore, cfg.thresholds) : null;
  const dir = biasClass ? directionOf(biasClass) : 0;
  return {
    meta: getMeta(symbol),
    symbol: symbol.id,
    display: symbol.display,
    rows,
    bias: {
      score: biasScore,
      classification: biasClass,
      label: (dir === 1 ? "Bullish" : dir === -1 ? "Bearish" : "Neutral") as Trend,
      agreeing: valid.filter((r) => Math.sign(r.score ?? 0) === Math.sign(biasScore ?? 0) && (r.score ?? 0) !== 0).length,
      total: valid.length,
    },
  };
}

// ── Market overview ──────────────────────────────────────────────────────────

export async function getMarkets(tf: Timeframe, cfg: EngineConfig, featuredOnly: boolean) {
  const { provider } = getProviderState();
  const list = (featuredOnly ? FEATURED_SYMBOLS : SYMBOLS).filter((s) => provider.supports(s));
  const barsPerDay = Math.max(1, Math.round(86400 / TIMEFRAME_SECONDS[tf]));
  const rows = await Promise.all(
    list.map(async (s) => {
      try {
        const candles = closedCandles(await getCandles(s, tf, ANALYSIS_BARS), tf);
        ensureEnoughData(candles, cfg, s, tf);
        const ind = computeIndicators(candles, cfg.indicators);
        const ev = evaluateAt(candles, ind, candles.length - 1, cfg);
        const last = candles[candles.length - 1];
        const ref = candles[Math.max(0, candles.length - 1 - barsPerDay)];
        return {
          symbol: s.id,
          display: s.display,
          name: s.name,
          assetClass: s.assetClass,
          precision: s.precision,
          ok: true as const,
          price: last.close,
          change24hPct: ((last.close - ref.close) / ref.close) * 100,
          classification: ev.classification,
          score: ev.score,
          trend: ev.trend,
          rsi: ev.snapshot.rsi,
          spark: candles.slice(-48).map((c) => c.close),
        };
      } catch (e) {
        return { symbol: s.id, display: s.display, name: s.name, assetClass: s.assetClass, precision: s.precision, ok: false as const, error: (e as Error).message };
      }
    }),
  );
  return { meta: getMeta(), timeframe: tf, rows };
}

// ── Backtest & history ───────────────────────────────────────────────────────

export async function backtestSymbol(symbol: SymbolInfo, tf: Timeframe, cfg: EngineConfig, bars: number, minStrength: "normal" | "strong" = "normal"): Promise<BacktestResult> {
  const candles = closedCandles(await getCandles(symbol, tf, bars), tf);
  ensureEnoughData(candles, cfg, symbol, tf);
  return runBacktest(candles, cfg, symbol.id, tf, { minStrength });
}

export function combineResults(results: BacktestResult[]) {
  const trades = results.flatMap((r) => r.trades);
  return { metrics: computeMetrics(trades), equity: equityCurve(trades) };
}

export interface HistoryRow extends BacktestTrade {
  display: string;
  precision: number;
}

export async function getHistory(
  symbols: SymbolInfo[],
  timeframes: Timeframe[],
  cfg: EngineConfig,
): Promise<{ rows: HistoryRow[]; errors: string[] }> {
  const { provider } = getProviderState();
  const jobs = symbols.filter((s) => provider.supports(s)).flatMap((s) => timeframes.map((tf) => ({ s, tf })));
  const errors: string[] = [];
  const results = await Promise.all(
    jobs.map(async ({ s, tf }) => {
      try {
        const r = await backtestSymbol(s, tf, cfg, ANALYSIS_BARS);
        return r.trades.map((t) => ({ ...t, display: s.display, precision: s.precision }));
      } catch (e) {
        errors.push(`${s.display} ${tf}: ${(e as Error).message}`);
        return [];
      }
    }),
  );
  return { rows: results.flat().sort((a, b) => b.signalTime - a.signalTime), errors };
}
