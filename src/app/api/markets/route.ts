import { handleError, ok } from "@/lib/api";
import { getMarkets } from "@/lib/service";
import { configFromQuery, parseTimeframe } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** GET /api/markets?timeframe=1h&all=1 — price, 24h change and signal for each symbol. */
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const timeframe = parseTimeframe(sp.get("timeframe"));
    const cfg = configFromQuery(sp);
    return ok(await getMarkets(timeframe, cfg, sp.get("all") !== "1"));
  } catch (e) {
    return handleError(e);
  }
}
