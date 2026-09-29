/** Shared domain types used by both the backend engine and the UI. */

export type Timeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d";

export const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"];

export const TIMEFRAME_LABEL: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1H",
  "4h": "4H",
  "1d": "1D",
};

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};

/** One OHLCV bar. `time` is the bar's open time in UNIX seconds (UTC). */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type SignalClass = "STRONG_BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG_SELL";

export const SIGNAL_LABEL: Record<SignalClass, string> = {
  STRONG_BUY: "STRONG BUY",
  BUY: "BUY",
  NEUTRAL: "NEUTRAL",
  SELL: "SELL",
  STRONG_SELL: "STRONG SELL",
};

export type Trend = "Bullish" | "Bearish" | "Neutral";
export type Direction = 1 | -1 | 0;

/** Metadata about where the candles came from — attached to every market response. */
export interface DataMeta {
  provider: string;
  providerName: string;
  isLive: boolean;
  sourceSymbol?: string;
  warning?: string;
}

/** A single scored factor that contributed (or could have contributed) to a signal. */
export interface SignalFactor {
  id: string;
  side: "buy" | "sell";
  label: string;
  detail: string;
  weight: number;
  met: boolean;
}

export interface IndicatorSnapshot {
  close: number;
  emaFast: number | null;
  emaMid: number | null;
  emaSlow: number | null;
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  stochK: number | null;
  stochD: number | null;
  atr: number | null;
  atrPct: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  bbWidthPct: number | null;
  volume: number;
  volumeMa: number | null;
  volumeRatio: number | null;
}

export interface PriceActionState {
  breakout: boolean;
  breakoutLevel: number | null;
  breakdown: boolean;
  breakdownLevel: number | null;
  higherHigh: boolean;
  lowerHigh: boolean;
  higherLow: boolean;
  lowerLow: boolean;
  supportBounce: boolean;
  resistanceRejection: boolean;
  volumeConfirmed: boolean;
  volumeSpike: boolean;
  emaCrossUpBarsAgo: number | null;
  emaCrossDownBarsAgo: number | null;
}

export interface Level {
  price: number;
  touches: number;
  kind: "support" | "resistance";
}

export interface TradeSetup {
  direction: "long" | "short";
  entryLow: number;
  entryHigh: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskReward1: number;
  riskReward2: number;
}

export interface SignalEvaluation {
  index: number;
  time: number;
  close: number;
  buyScore: number;
  sellScore: number;
  /** buyScore − sellScore, clamped to [−100, 100]. */
  score: number;
  classification: SignalClass;
  /** |score| as 0–100. A signal-strength score, NOT a probability of profit. */
  strength: number;
  trend: Trend;
  factors: SignalFactor[];
  snapshot: IndicatorSnapshot;
  priceAction: PriceActionState;
  supports: Level[];
  resistances: Level[];
  setup: TradeSetup | null;
  explanation: string;
}

export type TradeStatus = "Active" | "Target Hit" | "Stop Hit" | "Expired";

export interface BacktestTrade {
  id: string;
  symbol: string;
  timeframe: Timeframe;
  signal: SignalClass;
  score: number;
  signalTime: number;
  entryTime: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  direction: "long" | "short";
  status: TradeStatus;
  exitTime: number | null;
  exitPrice: number | null;
  /** Result in R multiples (risk units). Unrealised for Active trades. */
  rMultiple: number;
  barsHeld: number;
}

export interface BacktestMetrics {
  totalSignals: number;
  closedTrades: number;
  activeTrades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  averageR: number | null;
  totalR: number;
  profitFactor: number | null;
  maxDrawdownR: number;
  averageDurationSec: number | null;
  targetHits: number;
  stopHits: number;
  expired: number;
}

export interface SignalMarker {
  time: number;
  classification: SignalClass;
  score: number;
  price: number;
}
