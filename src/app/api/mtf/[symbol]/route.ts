import { handleError, ok } from "@/lib/api";
import { getMultiTimeframe } from "@/lib/service";
import { configFromQuery, parseSymbol } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** GET /api/mtf/:symbol — signal per timeframe plus a weighted overall bias. */
export async function GET(req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    const { symbol: raw } = await params;
    const sp = new URL(req.url).searchParams;
    const symbol = parseSymbol(raw);
    const cfg = configFromQuery(sp);
    return ok(await getMultiTimeframe(symbol, cfg));
  } catch (e) {
    return handleError(e);
  }
}
