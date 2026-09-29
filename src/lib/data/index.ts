/**
 * Provider factory + a small in-memory cache so repeated requests (multi-
 * timeframe views, history, polling) don't hammer rate-limited APIs.
 */
import type { SymbolInfo } from "../symbols";
import { TIMEFRAME_SECONDS, type Candle, type DataMeta, type Timeframe } from "../types";
import { BinanceProvider } from "./binanceProvider";
import { MockProvider } from "./mockProvider";
import { ProviderError, type MarketDataProvider } from "./provider";
import { TwelveDataProvider } from "./twelveDataProvider";

export { ProviderError, type MarketDataProvider };

interface ProviderState {
  provider: MarketDataProvider;
  /** Set when the requested provider could not be configured. */
  warning?: string;
}

let state: ProviderState | null = null;

function createProvider(): ProviderState {
  const requested = (process.env.MARKET_DATA_PROVIDER || "mock").trim().toLowerCase();
  switch (requested) {
    case "mock":
      return { provider: new MockProvider() };
    case "binance":
      return { provider: new BinanceProvider() };
    case "twelvedata": {
      const key = process.env.TWELVE_DATA_API_KEY?.trim();
      if (!key) {
        return {
          provider: new MockProvider(),
          warning: "MARKET_DATA_PROVIDER=twelvedata but TWELVE_DATA_API_KEY is not set — falling back to demo data.",
        };
      }
      return { provider: new TwelveDataProvider(key) };
    }
    default:
      return {
        provider: new MockProvider(),
        warning: `Unknown MARKET_DATA_PROVIDER "${requested}" — falling back to demo data.`,
      };
  }
}

export function getProviderState(): ProviderState {
  if (!state) {
    state = createProvider();
    if (state.warning) console.warn(`[data] ${state.warning}`);
  }
  return state;
}

export function getMeta(symbol?: SymbolInfo): DataMeta {
  const { provider, warning } = getProviderState();
  return {
    provider: provider.id,
    providerName: provider.name,
    isLive: provider.isLive,
    sourceSymbol: symbol ? provider.sourceSymbol(symbol) : undefined,
    warning,
  };
}

const cache = new Map<string, { expires: number; data: Promise<Candle[]> }>();
const MAX_CACHE = 300;

function ttlMs(timeframe: Timeframe, live: boolean): number {
  // Live data: refresh at most every 15 s (1m) up to 60 s. Mock data changes rarely.
  if (!live) return 30_000;
  return Math.min(60_000, Math.max(15_000, (TIMEFRAME_SECONDS[timeframe] * 1000) / 8));
}

function sanitize(candles: Candle[]): Candle[] {
  const out: Candle[] = [];
  for (const c of candles) {
    const ok = [c.time, c.open, c.high, c.low, c.close, c.volume].every(Number.isFinite) && c.high >= c.low && c.low > 0;
    if (!ok) continue;
    if (out.length && c.time <= out[out.length - 1].time) continue; // keep strictly increasing
    out.push(c);
  }
  return out;
}

export async function getCandles(symbol: SymbolInfo, timeframe: Timeframe, limit: number): Promise<Candle[]> {
  const { provider } = getProviderState();
  if (!provider.supports(symbol)) {
    throw new ProviderError(`${symbol.display} is not supported by the ${provider.name} provider`, 400);
  }
  // Always fetch a fixed large window per key, then slice — improves cache hits.
  const fetchLimit = Math.max(limit, 1000);
  const key = `${provider.id}|${symbol.id}|${timeframe}|${fetchLimit}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) return (await hit.data).slice(-limit);

  const data = provider.getCandles(symbol, timeframe, fetchLimit).then(sanitize);
  cache.set(key, { expires: now + ttlMs(timeframe, provider.isLive), data });
  data.catch(() => cache.delete(key));
  if (cache.size > MAX_CACHE) {
    for (const [k, v] of cache) if (v.expires <= now) cache.delete(k);
    if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value!);
  }
  return (await data).slice(-limit);
}
