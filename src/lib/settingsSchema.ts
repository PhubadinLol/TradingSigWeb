/**
 * Client-side settings model. Engine-related values are stored as *overrides*
 * of the server defaults, so clearing a field falls back to the server config.
 * Field bounds mirror `overridesSchema` in validation.ts.
 */
import type { ConfigOverrides } from "./config";
import type { Timeframe } from "./types";

export interface AlertRule {
  id: string;
  symbol: string;
  timeframe: Timeframe;
  /** Minimum |signal score| (0–100) required to notify. */
  minStrength: number;
  enabled: boolean;
}

export interface UserSettings {
  theme: "dark" | "light";
  timezone: string;
  refreshSeconds: number;
  overrides: ConfigOverrides;
  risk: { accountBalance: number; riskPct: number };
  alerts: { enabled: boolean; cooldownMinutes: number; rules: AlertRule[] };
}

export const DEFAULT_SETTINGS: UserSettings = {
  theme: "dark",
  timezone: "local",
  refreshSeconds: 60,
  overrides: {},
  risk: { accountBalance: 10000, riskPct: 1 },
  alerts: { enabled: false, cooldownMinutes: 30, rules: [] },
};

export interface FieldSpec {
  key: keyof ConfigOverrides;
  label: string;
  min: number;
  max: number;
  step: number;
  integer?: boolean;
  help?: string;
}

export const INDICATOR_FIELDS: FieldSpec[] = [
  { key: "emaFast", label: "EMA fast", min: 2, max: 100, step: 1, integer: true },
  { key: "emaMid", label: "EMA mid", min: 3, max: 300, step: 1, integer: true },
  { key: "emaSlow", label: "EMA slow", min: 5, max: 400, step: 1, integer: true },
  { key: "rsiPeriod", label: "RSI period", min: 2, max: 50, step: 1, integer: true },
  { key: "atrPeriod", label: "ATR period", min: 2, max: 50, step: 1, integer: true },
  { key: "bbPeriod", label: "Bollinger period", min: 5, max: 100, step: 1, integer: true },
  { key: "bbStdDev", label: "Bollinger std-dev", min: 0.5, max: 4, step: 0.1 },
  { key: "volumeConfirmMultiplier", label: "Volume confirm ×", min: 1, max: 5, step: 0.1, help: "Volume must exceed its average by this factor" },
];

export const THRESHOLD_FIELDS: FieldSpec[] = [
  { key: "strongBuy", label: "Strong buy ≥", min: 1, max: 100, step: 1 },
  { key: "buy", label: "Buy ≥", min: 1, max: 100, step: 1 },
  { key: "sell", label: "Sell ≤", min: -100, max: -1, step: 1 },
  { key: "strongSell", label: "Strong sell ≤", min: -100, max: -1, step: 1 },
];

export const RISK_FIELDS: FieldSpec[] = [
  { key: "atrStopMultiplier", label: "Fallback stop (× ATR)", min: 0.25, max: 10, step: 0.25 },
  { key: "tp1R", label: "Take profit 1 (R)", min: 0.25, max: 20, step: 0.25 },
  { key: "tp2R", label: "Take profit 2 (R)", min: 0.25, max: 30, step: 0.25 },
];

/** Serialise overrides into query-string params understood by the API. */
export function overridesToQuery(o: ConfigOverrides): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined && v !== null && Number.isFinite(v)) sp.set(k, String(v));
  }
  return sp.toString();
}

export const TIMEZONES = [
  "local",
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Australia/Sydney",
];
