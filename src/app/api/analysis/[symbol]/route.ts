import { handleError, ok } from "@/lib/api";
import { getAnalysis } from "@/lib/service";
import { configFromQuery, parseIntParam, parseSymbol, parseTimeframe } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * GET /api/analysis/:symbol?timeframe=1h&limit=400
 * Candles plus indicator series, support/resistance and historical signal markers for charting.
 */
export async function GET(req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    const { symbol: raw } = await params;
    const sp = new URL(req.url).searchParams;
    const symbol = parseSymbol(raw);
    const timeframe = parseTimeframe(sp.get("timeframe"));
    const limit = parseIntParam(sp.get("limit"), 400, 50, 1000, "limit");
    const cfg = configFromQuery(sp);
    return ok(await getAnalysis(symbol, timeframe, cfg, limit));
  } catch (e) {
    return handleError(e);
  }
}
