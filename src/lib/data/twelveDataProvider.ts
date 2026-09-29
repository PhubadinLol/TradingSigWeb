/**
 * Twelve Data time-series API — forex, metals and crypto.
 * Requires TWELVE_DATA_API_KEY (read from the server environment only).
 * https://twelvedata.com/docs#time-series
 */
import type { SymbolInfo } from "../symbols";
import type { Candle, Timeframe } from "../types";
import { ProviderError, type MarketDataProvider } from "./provider";

const INTERVAL: Record<Timeframe, string> = {
  "1m": "1min",
  "5m": "5min",
  "15m": "15min",
  "30m": "30min",
  "1h": "1h",
  "4h": "4h",
  "1d": "1day",
};

interface TwelveDataResponse {
  status?: string;
  message?: string;
  code?: number;
  values?: { datetime: string; open: string; high: string; low: string; close: string; volume?: string }[];
}

function parseUtc(dt: string): number {
  const iso = dt.includes(" ") ? `${dt.replace(" ", "T")}Z` : `${dt}T00:00:00Z`;
  return Math.floor(Date.parse(iso) / 1000);
}

export class TwelveDataProvider implements MarketDataProvider {
  readonly id = "twelvedata";
  readonly name = "Twelve Data";
  readonly isLive = true;

  constructor(private readonly apiKey: string) {}

  supports(symbol: SymbolInfo): boolean {
    return !!symbol.twelveData;
  }

  sourceSymbol(symbol: SymbolInfo): string | undefined {
    return symbol.twelveData;
  }

  async getCandles(symbol: SymbolInfo, timeframe: Timeframe, limit: number): Promise<Candle[]> {
    if (!symbol.twelveData) throw new ProviderError(`${symbol.display} is not available from Twelve Data`, 400);
    const url = new URL("https://api.twelvedata.com/time_series");
    url.searchParams.set("symbol", symbol.twelveData);
    url.searchParams.set("interval", INTERVAL[timeframe]);
    url.searchParams.set("outputsize", String(Math.min(limit, 5000)));
    url.searchParams.set("timezone", "UTC");
    url.searchParams.set("order", "ASC");

    let res: Response;
    try {
      // Key goes in a header rather than the URL so it never shows up in logs.
      res = await fetch(url, {
        cache: "no-store",
        headers: { Authorization: `apikey ${this.apiKey}` },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (e) {
      throw new ProviderError(`Could not reach Twelve Data: ${(e as Error).message}`);
    }
    if (!res.ok) throw new ProviderError(`Twelve Data responded with HTTP ${res.status}`, res.status === 429 ? 429 : 502);
    const body = (await res.json()) as TwelveDataResponse;
    if (body.status === "error" || !body.values) {
      throw new ProviderError(`Twelve Data: ${body.message ?? "no data returned"}`, body.code === 429 ? 429 : 502);
    }
    return body.values
      .map((v) => ({
        time: parseUtc(v.datetime),
        open: Number(v.open),
        high: Number(v.high),
        low: Number(v.low),
        close: Number(v.close),
        volume: v.volume ? Number(v.volume) : 0,
      }))
      .sort((a, b) => a.time - b.time);
  }
}
