/**
 * Registry of supported symbols. Each provider maps a symbol to its own ticker
 * format; a provider that has no mapping for a symbol does not support it.
 */

export type AssetClass = "crypto" | "forex" | "metal";

export interface SymbolInfo {
  /** URL-safe id used in API paths, e.g. "BTCUSDT". */
  id: string;
  /** Human-readable pair, e.g. "BTC/USDT". */
  display: string;
  name: string;
  assetClass: AssetClass;
  /** Decimal places used when formatting prices. */
  precision: number;
  featured: boolean;
  /** Provider ticker mappings. */
  binance?: string;
  twelveData?: string;
  /** Parameters for the mock generator only — never shown as real prices. */
  mock: { basePrice: number; dailyVol: number; baseVolume: number };
}

export const SYMBOLS: SymbolInfo[] = [
  {
    id: "BTCUSDT", display: "BTC/USDT", name: "Bitcoin", assetClass: "crypto", precision: 2, featured: true,
    binance: "BTCUSDT", twelveData: "BTC/USD", mock: { basePrice: 64000, dailyVol: 0.03, baseVolume: 1200 },
  },
  {
    id: "ETHUSDT", display: "ETH/USDT", name: "Ethereum", assetClass: "crypto", precision: 2, featured: true,
    binance: "ETHUSDT", twelveData: "ETH/USD", mock: { basePrice: 3200, dailyVol: 0.038, baseVolume: 9000 },
  },
  {
    id: "SOLUSDT", display: "SOL/USDT", name: "Solana", assetClass: "crypto", precision: 3, featured: true,
    binance: "SOLUSDT", twelveData: "SOL/USD", mock: { basePrice: 150, dailyVol: 0.05, baseVolume: 60000 },
  },
  {
    id: "EURUSD", display: "EUR/USD", name: "Euro / US Dollar", assetClass: "forex", precision: 5, featured: true,
    twelveData: "EUR/USD", mock: { basePrice: 1.085, dailyVol: 0.005, baseVolume: 4000 },
  },
  {
    id: "GBPUSD", display: "GBP/USD", name: "British Pound / US Dollar", assetClass: "forex", precision: 5, featured: true,
    twelveData: "GBP/USD", mock: { basePrice: 1.27, dailyVol: 0.006, baseVolume: 3500 },
  },
  {
    id: "USDJPY", display: "USD/JPY", name: "US Dollar / Japanese Yen", assetClass: "forex", precision: 3, featured: true,
    twelveData: "USD/JPY", mock: { basePrice: 150, dailyVol: 0.006, baseVolume: 3800 },
  },
  {
    id: "XAUUSD", display: "XAU/USD", name: "Gold / US Dollar", assetClass: "metal", precision: 2, featured: true,
    twelveData: "XAU/USD", mock: { basePrice: 2350, dailyVol: 0.009, baseVolume: 2500 },
  },
  // Additional searchable symbols
  {
    id: "BNBUSDT", display: "BNB/USDT", name: "BNB", assetClass: "crypto", precision: 2, featured: false,
    binance: "BNBUSDT", twelveData: "BNB/USD", mock: { basePrice: 580, dailyVol: 0.035, baseVolume: 15000 },
  },
  {
    id: "XRPUSDT", display: "XRP/USDT", name: "XRP", assetClass: "crypto", precision: 4, featured: false,
    binance: "XRPUSDT", twelveData: "XRP/USD", mock: { basePrice: 0.55, dailyVol: 0.045, baseVolume: 5e6 },
  },
  {
    id: "ADAUSDT", display: "ADA/USDT", name: "Cardano", assetClass: "crypto", precision: 4, featured: false,
    binance: "ADAUSDT", twelveData: "ADA/USD", mock: { basePrice: 0.45, dailyVol: 0.045, baseVolume: 4e6 },
  },
  {
    id: "DOGEUSDT", display: "DOGE/USDT", name: "Dogecoin", assetClass: "crypto", precision: 5, featured: false,
    binance: "DOGEUSDT", twelveData: "DOGE/USD", mock: { basePrice: 0.14, dailyVol: 0.055, baseVolume: 2e7 },
  },
  {
    id: "AUDUSD", display: "AUD/USD", name: "Australian Dollar / US Dollar", assetClass: "forex", precision: 5, featured: false,
    twelveData: "AUD/USD", mock: { basePrice: 0.66, dailyVol: 0.006, baseVolume: 3000 },
  },
  {
    id: "USDCHF", display: "USD/CHF", name: "US Dollar / Swiss Franc", assetClass: "forex", precision: 5, featured: false,
    twelveData: "USD/CHF", mock: { basePrice: 0.9, dailyVol: 0.005, baseVolume: 2800 },
  },
  {
    id: "USDCAD", display: "USD/CAD", name: "US Dollar / Canadian Dollar", assetClass: "forex", precision: 5, featured: false,
    twelveData: "USD/CAD", mock: { basePrice: 1.36, dailyVol: 0.0045, baseVolume: 2900 },
  },
  {
    id: "XAGUSD", display: "XAG/USD", name: "Silver / US Dollar", assetClass: "metal", precision: 3, featured: false,
    twelveData: "XAG/USD", mock: { basePrice: 29, dailyVol: 0.016, baseVolume: 2000 },
  },
];

const BY_ID = new Map(SYMBOLS.map((s) => [s.id, s]));

export const FEATURED_SYMBOLS = SYMBOLS.filter((s) => s.featured);

/** Accepts "BTCUSDT", "btc-usdt", "BTC/USDT" etc. */
export function normalizeSymbolId(raw: string): string {
  return decodeURIComponent(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function getSymbol(raw: string): SymbolInfo | undefined {
  return BY_ID.get(normalizeSymbolId(raw));
}

export function searchSymbols(query: string): SymbolInfo[] {
  const q = query.trim().toUpperCase().replace(/[^A-Z0-9 ]/g, "");
  if (!q) return SYMBOLS;
  return SYMBOLS.filter(
    (s) =>
      s.id.includes(q.replace(/ /g, "")) ||
      s.name.toUpperCase().includes(q) ||
      s.display.replace("/", "").includes(q.replace(/ /g, "")),
  );
}
