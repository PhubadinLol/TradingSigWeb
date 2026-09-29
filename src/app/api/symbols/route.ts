import { handleError, ok } from "@/lib/api";
import { getProviderState } from "@/lib/data";
import { searchSymbols } from "@/lib/symbols";

export const dynamic = "force-dynamic";

/** GET /api/symbols?q=eth — search supported symbols. */
export async function GET(req: Request) {
  try {
    const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 32);
    const { provider } = getProviderState();
    const results = searchSymbols(q).map((s) => ({
      id: s.id,
      display: s.display,
      name: s.name,
      assetClass: s.assetClass,
      featured: s.featured,
      supported: provider.supports(s),
    }));
    return ok({ results });
  } catch (e) {
    return handleError(e);
  }
}
