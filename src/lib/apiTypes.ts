/**
 * Response types for the REST API, derived from the service layer so the
 * client and server can never drift apart. Type-only imports — no server code
 * is bundled into the browser.
 */
import type { getAnalysis, getMarkets, getMultiTimeframe, getSignal, HistoryRow } from "./service";
import type { EngineConfig } from "./config";
import type { BacktestMetrics, BacktestTrade, DataMeta, Timeframe } from "./types";

export type SignalResponse = Awaited<ReturnType<typeof getSignal>>;
export type AnalysisResponse = Awaited<ReturnType<typeof getAnalysis>>;
export type MtfResponse = Awaited<ReturnType<typeof getMultiTimeframe>>;
export type MarketsResponse = Awaited<ReturnType<typeof getMarkets>>;
export type MarketRow = MarketsResponse["rows"][number];

export interface StatusResponse {
  meta: DataMeta;
  serverTime: number;
  config: Pick<EngineConfig, "indicators" | "weights" | "thresholds" | "risk" | "mtfWeights">;
}

export interface HistoryResponse {
  meta: DataMeta;
  source: string;
  total: number;
  rows: HistoryRow[];
  errors: string[];
}

export interface SymbolSearchResponse {
  results: { id: string; display: string; name: string; assetClass: string; featured: boolean; supported: boolean }[];
}

export type TradeRow = BacktestTrade & { display: string; precision: number };

export interface BacktestResponse {
  meta: DataMeta;
  kind: "historical-backtest";
  timeframe: Timeframe;
  settings: {
    target: "tp1" | "tp2";
    minStrength: "normal" | "strong";
    maxBarsInTrade: number;
    thresholds: EngineConfig["thresholds"];
    tp1R: number;
    tp2R: number;
  };
  combined: { metrics: BacktestMetrics; equity: { time: number; value: number }[] };
  perSymbol: (
    | { symbol: string; display: string; precision: number; ok: true; metrics: BacktestMetrics; from: number | null; to: number | null; bars: number }
    | { symbol: string; display: string; precision: number; ok: false; error: string }
  )[];
  trades: TradeRow[];
}
