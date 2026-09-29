import { handleError, ok } from "@/lib/api";
import { getCandles, getMeta } from "@/lib/data";
import { parseIntParam, parseSymbol, parseTimeframe } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** GET /api/market/:symbol?timeframe=1h&limit=300 — raw OHLCV candles. */
export async function GET(req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    const { symbol: raw } = await params;
    const sp = new URL(req.url).searchParams;
    const symbol = parseSymbol(raw);
    const timeframe = parseTimeframe(sp.get("timeframe"));
    const limit = parseIntParam(sp.get("limit"), 300, 10, 1000, "limit");
    const candles = await getCandles(symbol, timeframe, limit);
    return ok({ meta: getMeta(symbol), symbol: symbol.id, display: symbol.display, timeframe, candles });
  } catch (e) {
    return handleError(e);
  }
}
