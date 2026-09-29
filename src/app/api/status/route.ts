import { handleError, ok } from "@/lib/api";
import { getMeta } from "@/lib/data";
import { getServerConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

/** GET /api/status — active data provider and server-side engine defaults (no secrets). */
export async function GET() {
  try {
    const cfg = getServerConfig();
    return ok({
      meta: getMeta(),
      serverTime: Math.floor(Date.now() / 1000),
      config: {
        indicators: cfg.indicators,
        weights: cfg.weights,
        thresholds: cfg.thresholds,
        risk: cfg.risk,
        mtfWeights: cfg.mtfWeights,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
