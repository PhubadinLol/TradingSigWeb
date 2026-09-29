/** Input validation for every API route (zod). */
import { z } from "zod";
import { applyOverrides, getServerConfig, validateThresholds, type ConfigOverrides, type EngineConfig } from "./config";
import { getSymbol, type SymbolInfo } from "./symbols";
import { TIMEFRAMES, type Timeframe } from "./types";

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export const timeframeSchema = z.enum(TIMEFRAMES as [Timeframe, ...Timeframe[]]);

const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
const num = (min: number, max: number) => z.coerce.number().min(min).max(max);

export const overridesSchema = z
  .object({
    emaFast: int(2, 100),
    emaMid: int(3, 300),
    emaSlow: int(5, 400),
    rsiPeriod: int(2, 50),
    atrPeriod: int(2, 50),
    bbPeriod: int(5, 100),
    bbStdDev: num(0.5, 4),
    volumeConfirmMultiplier: num(1, 5),
    strongBuy: num(1, 100),
    buy: num(1, 100),
    sell: num(-100, -1),
    strongSell: num(-100, -1),
    atrStopMultiplier: num(0.25, 10),
    tp1R: num(0.25, 20),
    tp2R: num(0.25, 30),
  })
  .partial()
  .strict();

export const OVERRIDE_KEYS = Object.keys(overridesSchema.shape) as (keyof ConfigOverrides)[];

export function parseSymbol(raw: string): SymbolInfo {
  const s = getSymbol(raw);
  if (!s) throw new ValidationError(`Unsupported symbol "${raw}"`, 404);
  return s;
}

export function parseTimeframe(raw: string | null, fallback: Timeframe = "1h"): Timeframe {
  if (raw === null || raw === "") return fallback;
  const r = timeframeSchema.safeParse(raw.toLowerCase());
  if (!r.success) throw new ValidationError(`Invalid timeframe "${raw}". Use one of ${TIMEFRAMES.join(", ")}`);
  return r.data;
}

export function parseIntParam(raw: string | null, fallback: number, min: number, max: number, name: string): number {
  if (raw === null || raw === "") return fallback;
  const r = int(min, max).safeParse(raw);
  if (!r.success) throw new ValidationError(`${name} must be an integer between ${min} and ${max}`);
  return r.data;
}

/** Build an EngineConfig from server defaults + validated overrides. */
export function resolveConfig(raw: unknown): EngineConfig {
  const r = overridesSchema.safeParse(raw ?? {});
  if (!r.success) {
    const issue = r.error.issues[0];
    throw new ValidationError(`Invalid setting ${issue.path.join(".") || ""}: ${issue.message}`);
  }
  const cfg = applyOverrides(getServerConfig(), r.data);
  const err = validateThresholds(cfg.thresholds);
  if (err) throw new ValidationError(`Invalid thresholds: ${err}`);
  const i = cfg.indicators;
  if (!(i.emaFast < i.emaMid && i.emaMid < i.emaSlow)) {
    throw new ValidationError("EMA periods must satisfy fast < mid < slow");
  }
  return cfg;
}

/** Pull override keys out of a query string. Unknown params are ignored. */
export function configFromQuery(sp: URLSearchParams): EngineConfig {
  const raw: Record<string, string> = {};
  for (const k of OVERRIDE_KEYS) {
    const v = sp.get(k);
    if (v !== null && v !== "") raw[k] = v;
  }
  return resolveConfig(raw);
}

export const backtestBodySchema = z
  .object({
    symbols: z.array(z.string().min(1).max(20)).min(1).max(15),
    timeframe: timeframeSchema,
    bars: z.number().int().min(300).max(1000).default(1000),
    target: z.enum(["tp1", "tp2"]).default("tp1"),
    minStrength: z.enum(["normal", "strong"]).default("normal"),
    maxBarsInTrade: z.number().int().min(5).max(500).optional(),
    overrides: z.record(z.unknown()).optional(),
  })
  .strict();
