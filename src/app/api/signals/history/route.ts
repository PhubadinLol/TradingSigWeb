import { handleError, ok } from "@/lib/api";
import { getMeta } from "@/lib/data";
import { getHistory } from "@/lib/service";
import { FEATURED_SYMBOLS } from "@/lib/symbols";
import type { SignalClass, Timeframe } from "@/lib/types";
import { configFromQuery, parseIntParam, parseSymbol, parseTimeframe, ValidationError } from "@/lib/validation";

export const dynamic = "force-dynamic";

const DEFAULT_TIMEFRAMES: Timeframe[] = ["15m", "1h", "4h", "1d"];
const SIGNALS: SignalClass[] = ["STRONG_BUY", "BUY", "SELL", "STRONG_SELL"];

function parseDate(raw: string | null, name: string, endOfDay = false): number | null {
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new ValidationError(`${name} must be YYYY-MM-DD`);
  const t = Date.parse(`${raw}T${endOfDay ? "23:59:59" : "00:00:00"}Z`);
  if (Number.isNaN(t)) throw new ValidationError(`${name} is not a valid date`);
  return Math.floor(t / 1000);
}

/**
 * GET /api/signals/history?symbol=BTCUSDT&timeframe=1h&signal=BUY&from=2026-01-01&to=2026-02-01&limit=200
 *
 * History is produced by replaying the signal engine over historical candles
 * (walk-forward, no look-ahead) and resolving each signal against later bars.
 */
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const symbolParam = sp.get("symbol");
    const tfParam = sp.get("timeframe");
    const signalParam = sp.get("signal");
    const symbols = symbolParam ? [parseSymbol(symbolParam)] : FEATURED_SYMBOLS;
    const timeframes = tfParam ? [parseTimeframe(tfParam)] : DEFAULT_TIMEFRAMES;
    if (signalParam && !SIGNALS.includes(signalParam as SignalClass)) {
      throw new ValidationError(`signal must be one of ${SIGNALS.join(", ")}`);
    }
    const from = parseDate(sp.get("from"), "from");
    const to = parseDate(sp.get("to"), "to", true);
    const limit = parseIntParam(sp.get("limit"), 200, 1, 1000, "limit");
    const cfg = configFromQuery(sp);

    const { rows, errors } = await getHistory(symbols, timeframes, cfg);
    const filtered = rows.filter(
      (r) =>
        (!signalParam || r.signal === signalParam) &&
        (from === null || r.signalTime >= from) &&
        (to === null || r.signalTime <= to),
    );
    return ok({
      meta: getMeta(),
      source: "backtest-replay",
      total: filtered.length,
      rows: filtered.slice(0, limit),
      errors,
    });
  } catch (e) {
    return handleError(e);
  }
}
