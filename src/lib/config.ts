/**
 * Engine configuration. All tunable numbers for indicators, scoring weights,
 * classification thresholds and trade-level placement live here so the signal
 * engine and the backtester always share one source of truth.
 *
 * Server defaults can be adjusted via environment variables (see .env.example),
 * and individual requests may pass validated overrides (see validation.ts).
 */
import type { Timeframe } from "./types";

export interface IndicatorConfig {
  emaFast: number;
  emaMid: number;
  emaSlow: number;
  rsiPeriod: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  stochRsiPeriod: number;
  stochK: number;
  stochD: number;
  atrPeriod: number;
  bbPeriod: number;
  bbStdDev: number;
  volumeMaPeriod: number;
  /** Volume must exceed volumeMa × this to count as "volume confirmation". */
  volumeConfirmMultiplier: number;
  /** Volume above volumeMa × this is flagged as a spike. */
  volumeSpikeMultiplier: number;
  /** Bars on each side required to confirm a swing high/low. */
  pivotLookback: number;
  /** Breakout = close crossing the highest high of the previous N bars. */
  breakoutLookback: number;
  /** How many bars back to look for support/resistance pivots. */
  srLookback: number;
}

/**
 * Points awarded when a factor is present. The same weight is used for the
 * bullish and bearish version of each factor so the scale is symmetric.
 * With the defaults each side can score at most 100.
 */
export interface SignalWeights {
  emaAlignment: number; // EMA fast > mid > slow (or inverse)
  priceVsEmaSlow: number; // close above / below EMA 200
  rsi: number; // RSI above / below 50
  macd: number; // MACD line above / below signal line
  breakout: number; // confirmed breakout / breakdown
  volume: number; // above-average volume in the direction of the candle
  srReaction: number; // support bounce / resistance rejection
}

/** signalScore boundaries. Scores strictly between `sell` and `buy` are NEUTRAL. */
export interface SignalThresholds {
  strongBuy: number;
  buy: number;
  sell: number;
  strongSell: number;
}

export interface RiskConfig {
  /** Fallback stop distance in ATRs when no nearby structure exists. */
  atrStopMultiplier: number;
  tp1R: number;
  tp2R: number;
  /** Width of the entry zone in ATRs. */
  entryZoneAtr: number;
  /** Backtest: close the trade at market after this many bars. */
  maxBarsInTrade: number;
  /** Backtest: which target defines a win. */
  backtestTarget: "tp1" | "tp2";
}

export interface EngineConfig {
  indicators: IndicatorConfig;
  weights: SignalWeights;
  thresholds: SignalThresholds;
  risk: RiskConfig;
  /** Weight of each timeframe when combining into an overall market bias. */
  mtfWeights: Record<Timeframe, number>;
}

export const DEFAULT_CONFIG: EngineConfig = {
  indicators: {
    emaFast: 20,
    emaMid: 50,
    emaSlow: 200,
    rsiPeriod: 14,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    stochRsiPeriod: 14,
    stochK: 3,
    stochD: 3,
    atrPeriod: 14,
    bbPeriod: 20,
    bbStdDev: 2,
    volumeMaPeriod: 20,
    volumeConfirmMultiplier: 1.5,
    volumeSpikeMultiplier: 2.5,
    pivotLookback: 3,
    breakoutLookback: 20,
    srLookback: 150,
  },
  weights: {
    emaAlignment: 20,
    priceVsEmaSlow: 15,
    rsi: 10,
    macd: 15,
    breakout: 20,
    volume: 10,
    srReaction: 10,
  },
  thresholds: { strongBuy: 60, buy: 30, sell: -30, strongSell: -60 },
  risk: {
    atrStopMultiplier: 1.5,
    tp1R: 1.5,
    tp2R: 3,
    entryZoneAtr: 0.25,
    maxBarsInTrade: 48,
    backtestTarget: "tp1",
  },
  mtfWeights: { "1m": 0.5, "5m": 0.75, "15m": 1, "30m": 1, "1h": 1.5, "4h": 2, "1d": 2.5 },
};

export function validateThresholds(t: SignalThresholds): string | null {
  if (!(t.strongBuy > t.buy)) return "strongBuy must be greater than buy";
  if (!(t.buy > 0)) return "buy must be positive";
  if (!(t.sell < 0)) return "sell must be negative";
  if (!(t.strongSell < t.sell)) return "strongSell must be less than sell";
  return null;
}

function thresholdsFromEnv(): SignalThresholds | null {
  const raw = process.env.SIGNAL_THRESHOLDS;
  if (!raw) return null;
  const parts = raw.split(",").map((p) => Number(p.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    console.warn("[config] Ignoring malformed SIGNAL_THRESHOLDS:", raw);
    return null;
  }
  const t = { strongBuy: parts[0], buy: parts[1], sell: parts[2], strongSell: parts[3] };
  const err = validateThresholds(t);
  if (err) {
    console.warn("[config] Ignoring invalid SIGNAL_THRESHOLDS:", err);
    return null;
  }
  return t;
}

/** Server-side base config: defaults + environment overrides. */
export function getServerConfig(): EngineConfig {
  const env = thresholdsFromEnv();
  return env ? { ...DEFAULT_CONFIG, thresholds: env } : DEFAULT_CONFIG;
}

/** Flat, user-overridable subset of the config (sent from the Settings page). */
export interface ConfigOverrides {
  emaFast?: number;
  emaMid?: number;
  emaSlow?: number;
  rsiPeriod?: number;
  atrPeriod?: number;
  bbPeriod?: number;
  bbStdDev?: number;
  volumeConfirmMultiplier?: number;
  strongBuy?: number;
  buy?: number;
  sell?: number;
  strongSell?: number;
  atrStopMultiplier?: number;
  tp1R?: number;
  tp2R?: number;
}

export function applyOverrides(base: EngineConfig, o: ConfigOverrides): EngineConfig {
  const pick = <T>(v: T | undefined, d: T) => (v === undefined ? d : v);
  return {
    ...base,
    indicators: {
      ...base.indicators,
      emaFast: pick(o.emaFast, base.indicators.emaFast),
      emaMid: pick(o.emaMid, base.indicators.emaMid),
      emaSlow: pick(o.emaSlow, base.indicators.emaSlow),
      rsiPeriod: pick(o.rsiPeriod, base.indicators.rsiPeriod),
      atrPeriod: pick(o.atrPeriod, base.indicators.atrPeriod),
      bbPeriod: pick(o.bbPeriod, base.indicators.bbPeriod),
      bbStdDev: pick(o.bbStdDev, base.indicators.bbStdDev),
      volumeConfirmMultiplier: pick(o.volumeConfirmMultiplier, base.indicators.volumeConfirmMultiplier),
    },
    thresholds: {
      strongBuy: pick(o.strongBuy, base.thresholds.strongBuy),
      buy: pick(o.buy, base.thresholds.buy),
      sell: pick(o.sell, base.thresholds.sell),
      strongSell: pick(o.strongSell, base.thresholds.strongSell),
    },
    risk: {
      ...base.risk,
      atrStopMultiplier: pick(o.atrStopMultiplier, base.risk.atrStopMultiplier),
      tp1R: pick(o.tp1R, base.risk.tp1R),
      tp2R: pick(o.tp2R, base.risk.tp2R),
    },
  };
}

/** Minimum number of bars the engine needs before it will emit a signal. */
export function warmupBars(cfg: EngineConfig): number {
  const i = cfg.indicators;
  return Math.max(i.emaSlow, i.macdSlow + i.macdSignal, i.rsiPeriod + i.stochRsiPeriod + i.stochK + i.stochD, i.bbPeriod, i.breakoutLookback) + 2;
}
