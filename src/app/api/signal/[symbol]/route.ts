import { handleError, ok } from "@/lib/api";
import { getSignal } from "@/lib/service";
import { configFromQuery, parseSymbol, parseTimeframe } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** GET /api/signal/:symbol?timeframe=1h — latest explainable signal on closed candles. */
export async function GET(req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    const { symbol: raw } = await params;
    const sp = new URL(req.url).searchParams;
    const symbol = parseSymbol(raw);
    const timeframe = parseTimeframe(sp.get("timeframe"));
    const cfg = configFromQuery(sp);
    return ok(await getSignal(symbol, timeframe, cfg));
  } catch (e) {
    return handleError(e);
  }
}
