/**
 * Deterministic demo data. Produces a plausible random walk with trending and
 * ranging regimes so the engine has something to analyse without an API key.
 *
 * These prices are SYNTHETIC. `isLive` is false and the UI shows a
 * "Demo Data" banner whenever this provider is active.
 */
import type { SymbolInfo } from "../symbols";
import { TIMEFRAME_SECONDS, type Candle, type Timeframe } from "../types";
import type { MarketDataProvider } from "./provider";

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Series are generated from a fixed anchor so refreshing returns the same
 * history; the anchor advances every BLOCK bars.
 */
const BLOCK = 1000;

export class MockProvider implements MarketDataProvider {
  readonly id = "mock";
  readonly name = "Demo data (synthetic)";
  readonly isLive = false;

  supports(): boolean {
    return true;
  }

  sourceSymbol(): string | undefined {
    return undefined;
  }

  async getCandles(symbol: SymbolInfo, timeframe: Timeframe, limit: number): Promise<Candle[]> {
    const tf = TIMEFRAME_SECONDS[timeframe];
    const nowIdx = Math.floor(Date.now() / 1000 / tf);
    const startIdx = (Math.floor(nowIdx / BLOCK) - 1) * BLOCK;
    const rand = mulberry32(hashString(`${symbol.id}|${timeframe}|${startIdx}`));

    const sigma = symbol.mock.dailyVol * Math.sqrt(tf / 86400);
    let price = symbol.mock.basePrice * Math.exp(gaussian(rand) * 0.05);
    let drift = 0;
    let regimeLeft = 0;
    const candles: Candle[] = [];

    for (let k = startIdx; k <= nowIdx; k++) {
      if (regimeLeft <= 0) {
        // Regimes: up-trend, down-trend or range, lasting 30–150 bars.
        const r = rand();
        drift = r < 0.35 ? 0.18 * sigma : r < 0.7 ? -0.18 * sigma : 0;
        regimeLeft = 30 + Math.floor(rand() * 120);
      }
      regimeLeft--;
      // Mean-revert gently toward the base price so series stay in a sane range.
      const pull = -0.002 * Math.log(price / symbol.mock.basePrice);
      const ret = drift + pull + sigma * gaussian(rand);
      const open = price;
      const close = open * Math.exp(ret);
      const wick = () => Math.abs(gaussian(rand)) * sigma * 0.45;
      const high = Math.max(open, close) * Math.exp(wick());
      const low = Math.min(open, close) * Math.exp(-wick());
      const spike = rand() < 0.04 ? 2 + rand() * 2 : 1;
      const volume =
        symbol.mock.baseVolume * (tf / 3600) ** 0.8 * Math.exp(0.35 * gaussian(rand)) * (1 + Math.abs(ret) / sigma) * spike;
      candles.push({ time: k * tf, open, high, low, close, volume });
      price = close;
    }
    // Rescale so every timeframe ends at the same demo "current" price for this symbol.
    const last = candles[candles.length - 1];
    const f = anchorPrice(symbol, last.time + tf) / last.close;
    return candles.slice(-limit).map((c) => ({ ...c, open: c.open * f, high: c.high * f, low: c.low * f, close: c.close * f }));
  }
}

/** Smooth, deterministic demo price shared by all timeframes of a symbol. */
function anchorPrice(symbol: SymbolInfo, timeSec: number): number {
  const phase = (hashString(symbol.id) % 1000) / 1000;
  const day = timeSec / 86400;
  const scale = symbol.mock.dailyVol / 0.03;
  const wave =
    0.1 * Math.sin(2 * Math.PI * (day / 23 + phase)) +
    0.05 * Math.sin(2 * Math.PI * (day / 5.3 + phase * 2)) +
    0.015 * Math.sin(2 * Math.PI * (day / 0.7 + phase * 3));
  return symbol.mock.basePrice * Math.exp(wave * scale);
}
