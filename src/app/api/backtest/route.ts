import { handleError, ok } from "@/lib/api";
import { getMeta } from "@/lib/data";
import { backtestSymbol, combineResults } from "@/lib/service";
import { backtestBodySchema, parseSymbol, resolveConfig, ValidationError } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/backtest
 * Body: { symbols: string[], timeframe, bars?, target?, minStrength?, maxBarsInTrade?, overrides? }
 */
export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ValidationError("Request body must be valid JSON");
    }
    const input = backtestBodySchema.parse(body);
    const symbols = [...new Set(input.symbols.map((s) => parseSymbol(s)))];
    const base = resolveConfig(input.overrides);
    const cfg = {
      ...base,
      risk: {
        ...base.risk,
        backtestTarget: input.target,
        maxBarsInTrade: input.maxBarsInTrade ?? base.risk.maxBarsInTrade,
      },
    };

    const perSymbol = await Promise.all(
      symbols.map(async (s) => {
        try {
          const r = await backtestSymbol(s, input.timeframe, cfg, input.bars, input.minStrength);
          return { symbol: s.id, display: s.display, precision: s.precision, ok: true as const, ...r };
        } catch (e) {
          return { symbol: s.id, display: s.display, precision: s.precision, ok: false as const, error: (e as Error).message };
        }
      }),
    );
    const succeeded = perSymbol.filter((r) => r.ok);
    const combined = combineResults(succeeded);

    return ok({
      meta: getMeta(),
      kind: "historical-backtest",
      timeframe: input.timeframe,
      settings: {
        target: input.target,
        minStrength: input.minStrength,
        maxBarsInTrade: cfg.risk.maxBarsInTrade,
        thresholds: cfg.thresholds,
        tp1R: cfg.risk.tp1R,
        tp2R: cfg.risk.tp2R,
      },
      combined,
      perSymbol: perSymbol.map((r) =>
        r.ok
          ? { symbol: r.symbol, display: r.display, precision: r.precision, ok: true, metrics: r.metrics, from: r.from, to: r.to, bars: r.bars }
          : r,
      ),
      trades: succeeded
        .flatMap((r) => r.trades.map((t) => ({ ...t, display: r.display, precision: r.precision })))
        .sort((a, b) => b.signalTime - a.signalTime),
    });
  } catch (e) {
    return handleError(e);
  }
}
