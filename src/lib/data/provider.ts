import type { SymbolInfo } from "../symbols";
import type { Candle, Timeframe } from "../types";

/**
 * Contract every market-data source implements. To add a new provider,
 * implement this interface and register it in `data/index.ts`.
 */
export interface MarketDataProvider {
  /** Stable id, e.g. "mock", "binance", "twelvedata". */
  readonly id: string;
  readonly name: string;
  /** True only for providers that return real market data. */
  readonly isLive: boolean;
  supports(symbol: SymbolInfo): boolean;
  /** Provider-specific ticker for display, e.g. "BTCUSDT" or "EUR/USD". */
  sourceSymbol(symbol: SymbolInfo): string | undefined;
  /** Returns up to `limit` most recent candles, oldest first. */
  getCandles(symbol: SymbolInfo, timeframe: Timeframe, limit: number): Promise<Candle[]>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly status: number = 502,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
