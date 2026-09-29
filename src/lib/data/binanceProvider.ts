/**
 * Binance public market-data REST API (no API key needed for candles).
 * Supports crypto symbols only. https://developers.binance.com/docs/binance-spot-api-docs/rest-api
 */
import type { SymbolInfo } from "../symbols";
import type { Candle, Timeframe } from "../types";
import { ProviderError, type MarketDataProvider } from "./provider";

export class BinanceProvider implements MarketDataProvider {
  readonly id = "binance";
  readonly name = "Binance";
  readonly isLive = true;

  constructor(private readonly baseUrl: string = process.env.BINANCE_BASE_URL || "https://api.binance.com") {}

  supports(symbol: SymbolInfo): boolean {
    return !!symbol.binance;
  }

  sourceSymbol(symbol: SymbolInfo): string | undefined {
    return symbol.binance;
  }

  async getCandles(symbol: SymbolInfo, timeframe: Timeframe, limit: number): Promise<Candle[]> {
    if (!symbol.binance) throw new ProviderError(`${symbol.display} is not available from Binance`, 400);
    const url = new URL("/api/v3/klines", this.baseUrl);
    url.searchParams.set("symbol", symbol.binance);
    url.searchParams.set("interval", timeframe);
    url.searchParams.set("limit", String(Math.min(limit, 1000)));

    let res: Response;
    try {
      res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    } catch (e) {
      throw new ProviderError(`Could not reach Binance: ${(e as Error).message}`);
    }
    if (!res.ok) throw new ProviderError(`Binance responded with HTTP ${res.status}`, res.status === 429 ? 429 : 502);
    const rows = (await res.json()) as unknown;
    if (!Array.isArray(rows)) throw new ProviderError("Unexpected response from Binance");
    return rows.map((r: unknown[]) => ({
      time: Math.floor(Number(r[0]) / 1000),
      open: Number(r[1]),
      high: Number(r[2]),
      low: Number(r[3]),
      close: Number(r[4]),
      volume: Number(r[5]),
    }));
  }
}
